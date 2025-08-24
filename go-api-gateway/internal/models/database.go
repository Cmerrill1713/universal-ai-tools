// Database models for Universal AI Tools Go API Gateway
// Defines data structures for database health monitoring and management

package models

import "time"

// DatabaseHealth represents comprehensive database health information
type DatabaseHealth struct {
	Status       string              `json:"status"` // healthy, degraded, down
	Timestamp    time.Time           `json:"timestamp"`
	ResponseTime float64             `json:"response_time_ms"`
	Connections  ConnectionPool      `json:"connections"`
	Databases    []DatabaseInfo      `json:"databases"`
	Performance  DatabasePerformance `json:"performance"`
}

// ConnectionPool represents database connection pool information
type ConnectionPool struct {
	Active    int `json:"active"`
	Idle      int `json:"idle"`
	Total     int `json:"total"`
	MaxConns  int `json:"max_connections"`
	WaitCount int `json:"wait_count"`
}

// DatabaseInfo represents information about a specific database
type DatabaseInfo struct {
	Name         string         `json:"name"`
	Type         string         `json:"type"`   // primary, cache, graph
	Status       string         `json:"status"` // connected, disconnected, error
	Version      string         `json:"version"`
	Size         string         `json:"size"`
	LastBackup   time.Time      `json:"last_backup,omitempty"`
	ResponseTime float64        `json:"response_time_ms"`
	Connections  ConnectionPool `json:"connections"`
}

// DatabasePerformance represents database performance metrics
type DatabasePerformance struct {
	QueriesPerSecond float64 `json:"queries_per_second"`
	AverageQueryTime float64 `json:"average_query_time_ms"`
	SlowQueries      int     `json:"slow_queries"`
	CacheHitRatio    float64 `json:"cache_hit_ratio"`
	IndexEfficiency  float64 `json:"index_efficiency"`
	LockWaitTime     float64 `json:"lock_wait_time_ms"`
}

// DatabaseSystemStats represents system-level database statistics
type DatabaseSystemStats struct {
	Timestamp time.Time    `json:"timestamp"`
	Memory    MemoryStats  `json:"memory"`
	CPU       CPUStats     `json:"cpu"`
	Disk      DiskStats    `json:"disk"`
	Network   NetworkStats `json:"network"`
}

// MemoryStats represents memory usage statistics
type MemoryStats struct {
	Used      uint64  `json:"used_bytes"`
	Available uint64  `json:"available_bytes"`
	Total     uint64  `json:"total_bytes"`
	Percent   float64 `json:"percent"`
}

// CPUStats represents CPU usage statistics
type CPUStats struct {
	Usage     float64 `json:"usage_percent"`
	LoadAvg1  float64 `json:"load_avg_1m"`
	LoadAvg5  float64 `json:"load_avg_5m"`
	LoadAvg15 float64 `json:"load_avg_15m"`
}

// DiskStats represents disk usage statistics
type DiskStats struct {
	Used      uint64  `json:"used_bytes"`
	Available uint64  `json:"available_bytes"`
	Total     uint64  `json:"total_bytes"`
	Percent   float64 `json:"percent"`
	IOPs      int     `json:"iops"`
}

// NetworkStats represents network usage statistics
type NetworkStats struct {
	BytesIn    uint64 `json:"bytes_in"`
	BytesOut   uint64 `json:"bytes_out"`
	PacketsIn  uint64 `json:"packets_in"`
	PacketsOut uint64 `json:"packets_out"`
	ErrorsIn   uint64 `json:"errors_in"`
	ErrorsOut  uint64 `json:"errors_out"`
}

// QueryAnalytics represents database query performance analytics
type QueryAnalytics struct {
	TimeRange         string                    `json:"time_range"`
	TotalQueries      int64                     `json:"total_queries"`
	SuccessfulQueries int64                     `json:"successful_queries"`
	FailedQueries     int64                     `json:"failed_queries"`
	SuccessRate       float64                   `json:"success_rate"`
	AverageTime       float64                   `json:"average_time_ms"`
	P95Time           float64                   `json:"p95_time_ms"`
	P99Time           float64                   `json:"p99_time_ms"`
	SlowQueries       []SlowQuery               `json:"slow_queries"`
	QueryTypes        map[string]QueryTypeStats `json:"query_types"`
	HourlyStats       []HourlyQueryStats        `json:"hourly_stats"`
}

// SlowQuery represents a slow-performing query
type SlowQuery struct {
	Query    string    `json:"query"`
	Count    int       `json:"count"`
	AvgTime  float64   `json:"avg_time_ms"`
	MaxTime  float64   `json:"max_time_ms"`
	LastSeen time.Time `json:"last_seen"`
	Database string    `json:"database"`
}

// QueryTypeStats represents statistics for a specific query type
type QueryTypeStats struct {
	Count      int64   `json:"count"`
	AvgTime    float64 `json:"avg_time_ms"`
	Percentage float64 `json:"percentage"`
}

// HourlyQueryStats represents query statistics for a specific hour
type HourlyQueryStats struct {
	Hour        time.Time `json:"hour"`
	QueryCount  int64     `json:"query_count"`
	AvgTime     float64   `json:"avg_time_ms"`
	ErrorCount  int       `json:"error_count"`
	SlowQueries int       `json:"slow_queries"`
}

// ConnectionInfo represents detailed database connection information
type ConnectionInfo struct {
	Timestamp          time.Time     `json:"timestamp"`
	Pools              []PoolInfo    `json:"pools"`
	ActiveQueries      []ActiveQuery `json:"active_queries"`
	LongRunningQueries []ActiveQuery `json:"long_running_queries"`
}

// PoolInfo represents connection pool information for a specific database
type PoolInfo struct {
	Database     string        `json:"database"`
	MaxConns     int           `json:"max_connections"`
	OpenConns    int           `json:"open_connections"`
	InUseConns   int           `json:"in_use_connections"`
	IdleConns    int           `json:"idle_connections"`
	WaitCount    int64         `json:"wait_count"`
	WaitDuration time.Duration `json:"wait_duration"`
	MaxIdleTime  time.Duration `json:"max_idle_time"`
	MaxLifetime  time.Duration `json:"max_lifetime"`
}

// ActiveQuery represents a currently executing query
type ActiveQuery struct {
	ID       string        `json:"id"`
	Database string        `json:"database"`
	Query    string        `json:"query"`
	Duration time.Duration `json:"duration"`
	State    string        `json:"state"`
	User     string        `json:"user"`
}

// MaintenanceResult represents the result of database maintenance operations
type MaintenanceResult struct {
	Success    bool                   `json:"success"`
	StartTime  time.Time              `json:"start_time"`
	EndTime    time.Time              `json:"end_time"`
	Duration   time.Duration          `json:"duration"`
	Operations []MaintenanceOperation `json:"operations"`
}

// MaintenanceOperation represents a single maintenance operation
type MaintenanceOperation struct {
	Name      string                 `json:"name"`
	Status    string                 `json:"status"` // completed, failed, skipped
	StartTime time.Time              `json:"start_time"`
	EndTime   time.Time              `json:"end_time"`
	Duration  time.Duration          `json:"duration"`
	Result    string                 `json:"result"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

// BackupStatus represents information about database backups
type BackupStatus struct {
	LastBackup    time.Time    `json:"last_backup"`
	NextBackup    time.Time    `json:"next_backup"`
	BackupSize    string       `json:"backup_size"`
	Status        string       `json:"status"` // healthy, warning, error
	RetentionDays int          `json:"retention_days"`
	RecentBackups []BackupInfo `json:"recent_backups"`
	Configuration BackupConfig `json:"configuration"`
}

// BackupInfo represents information about a specific backup
type BackupInfo struct {
	ID        string        `json:"id"`
	Timestamp time.Time     `json:"timestamp"`
	Size      string        `json:"size"`
	Type      string        `json:"type"`   // full, incremental, differential
	Status    string        `json:"status"` // completed, failed, in_progress
	Duration  time.Duration `json:"duration"`
}

// BackupConfig represents backup configuration settings
type BackupConfig struct {
	Enabled     bool   `json:"enabled"`
	Schedule    string `json:"schedule"` // cron expression
	Retention   int    `json:"retention_days"`
	Compression bool   `json:"compression"`
	Encryption  bool   `json:"encryption"`
	Location    string `json:"location"`
}

// SchemaInfo represents database schema information
type SchemaInfo struct {
	DatabaseName string      `json:"database_name"`
	Version      string      `json:"version"`
	Tables       []TableInfo `json:"tables"`
	TotalTables  int         `json:"total_tables"`
	TotalSize    string      `json:"total_size"`
	LastUpdated  time.Time   `json:"last_updated"`
}

// TableInfo represents information about a database table
type TableInfo struct {
	Name    string `json:"name"`
	Columns int    `json:"columns"`
	Rows    int64  `json:"rows"`
	Size    string `json:"size"`
	Indexes int    `json:"indexes"`
}

// MigrationStatus represents database migration status
type MigrationStatus struct {
	CurrentVersion    string      `json:"current_version"`
	LatestVersion     string      `json:"latest_version"`
	PendingMigrations []Migration `json:"pending_migrations"`
	AppliedMigrations []Migration `json:"applied_migrations"`
	Status            string      `json:"status"` // up_to_date, pending, error
	LastChecked       time.Time   `json:"last_checked"`
}

// Migration represents a database migration
type Migration struct {
	ID          string        `json:"id"`
	Version     string        `json:"version"`
	Description string        `json:"description"`
	AppliedAt   time.Time     `json:"applied_at,omitempty"`
	Duration    time.Duration `json:"duration,omitempty"`
}
