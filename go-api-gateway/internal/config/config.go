// Configuration management for Go API Gateway
// Environment-based configuration with validation and defaults

package config

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// Config represents the complete application configuration
type Config struct {
	Environment string          `mapstructure:"environment"`
	Version     string          `mapstructure:"version"`
	Server      ServerConfig    `mapstructure:"server"`
	Database    DatabaseConfig  `mapstructure:"database"`
	Security    SecurityConfig  `mapstructure:"security"`
	Metrics     MetricsConfig   `mapstructure:"metrics"`
	Health      HealthConfig    `mapstructure:"health"`
	Migration   MigrationConfig `mapstructure:"migration"`
	RustAI      RustAIConfig    `mapstructure:"rust_ai"`
	LMStudio    LMStudioConfig  `mapstructure:"lm_studio"`
	HRM         HRMConfig       `mapstructure:"hrm"`
	AppFlowy    AppFlowyConfig  `mapstructure:"appflowy"`
	Logging     LoggingConfig   `mapstructure:"logging"`
}

// ServerConfig contains HTTP server configuration
type ServerConfig struct {
	Port         int `mapstructure:"port"`
	ReadTimeout  int `mapstructure:"read_timeout"`
	WriteTimeout int `mapstructure:"write_timeout"`
	IdleTimeout  int `mapstructure:"idle_timeout"`
	MaxConns     int `mapstructure:"max_connections"`
}

// DatabaseConfig contains database connection settings
type DatabaseConfig struct {
	PostgreSQL PostgreSQLConfig `mapstructure:"postgresql"`
	Redis      RedisConfig      `mapstructure:"redis"`
	Neo4j      Neo4jConfig      `mapstructure:"neo4j"`
}

// PostgreSQLConfig contains PostgreSQL-specific settings
type PostgreSQLConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	Database        string        `mapstructure:"database"`
	Username        string        `mapstructure:"username"`
	Password        string        `mapstructure:"password"`
	SSLMode         string        `mapstructure:"ssl_mode"`
	MaxConns        int           `mapstructure:"max_connections"`
	MinConns        int           `mapstructure:"min_connections"`
	MaxConnLifetime time.Duration `mapstructure:"max_connection_lifetime"`
	MaxConnIdleTime time.Duration `mapstructure:"max_connection_idle_time"`
}

// RedisConfig contains Redis-specific settings
type RedisConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	Password     string `mapstructure:"password"`
	Database     int    `mapstructure:"database"`
	MaxConns     int    `mapstructure:"max_connections"`
	MinIdleConns int    `mapstructure:"min_idle_connections"`
}

// Neo4jConfig contains Neo4j-specific settings
type Neo4jConfig struct {
	URI      string `mapstructure:"uri"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	MaxConns int    `mapstructure:"max_connections"`
}

// SecurityConfig contains security-related settings
type SecurityConfig struct {
	JWTSecret          string        `mapstructure:"jwt_secret"`
	JWTExpiration      time.Duration `mapstructure:"jwt_expiration"`
	BCryptCost         int           `mapstructure:"bcrypt_cost"`
	RateLimitPerMinute int           `mapstructure:"rate_limit_per_minute"`
	CORSAllowedOrigins []string      `mapstructure:"cors_allowed_origins"`
	TrustedProxies     []string      `mapstructure:"trusted_proxies"`
	RequireAuth        bool          `mapstructure:"require_auth"`
}

// MetricsConfig contains metrics and monitoring settings
type MetricsConfig struct {
	Enabled bool   `mapstructure:"enabled"`
	Port    int    `mapstructure:"port"`
	Path    string `mapstructure:"path"`
}

// HealthConfig contains health check settings
type HealthConfig struct {
	Port int    `mapstructure:"port"`
	Path string `mapstructure:"path"`
}

// MigrationConfig contains migration-specific settings
type MigrationConfig struct {
	EnableCompatibilityMode bool   `mapstructure:"enable_compatibility_mode"`
	TypeScriptEndpoint      string `mapstructure:"typescript_endpoint"`
	ProxyTimeout            int    `mapstructure:"proxy_timeout"`
	EnableTesting           bool   `mapstructure:"enable_testing"`
}

// RustAIConfig contains Rust AI service configuration
type RustAIConfig struct {
	Endpoint          string        `mapstructure:"endpoint"`
	GRPCPort          int           `mapstructure:"grpc_port"`
	ConnectionTimeout time.Duration `mapstructure:"connection_timeout"`
	RequestTimeout    time.Duration `mapstructure:"request_timeout"`
	MaxRetries        int           `mapstructure:"max_retries"`
}

// LMStudioConfig contains LM Studio configuration
type LMStudioConfig struct {
	Endpoint string `mapstructure:"endpoint"`
	Model    string `mapstructure:"model"`
	Enabled  bool   `mapstructure:"enabled"`
}

// HRMConfig contains Hierarchical Reasoning Model configuration
type HRMConfig struct {
	Endpoint       string        `mapstructure:"endpoint"`
	Timeout        time.Duration `mapstructure:"timeout"`
	MaxRetries     int           `mapstructure:"max_retries"`
	Enabled        bool          `mapstructure:"enabled"`
	DefaultMaxSteps int          `mapstructure:"default_max_steps"`
}

// AppFlowyConfig contains AppFlowy integration configuration
type AppFlowyConfig struct {
	Endpoint       string        `mapstructure:"endpoint"`
	APIKey         string        `mapstructure:"api_key"`
	WorkspaceID    string        `mapstructure:"workspace_id"`
	Timeout        time.Duration `mapstructure:"timeout"`
	MaxRetries     int           `mapstructure:"max_retries"`
	Enabled        bool          `mapstructure:"enabled"`
	MockMode       bool          `mapstructure:"mock_mode"`
}

// LoggingConfig contains logging configuration
type LoggingConfig struct {
	Level            string `mapstructure:"level"`
	Format           string `mapstructure:"format"`
	EnableStackTrace bool   `mapstructure:"enable_stack_trace"`
	EnableCaller     bool   `mapstructure:"enable_caller"`
}

// Load reads configuration from environment variables and config files
func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/etc/universal-ai-tools")

	// Set environment variable prefix
	viper.SetEnvPrefix("UAT")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	// Set defaults
	setDefaults()

	// Load .env file if it exists (for local development)
	if _, err := os.Stat(".env"); err == nil {
		if err := godotenv.Load(); err != nil {
			// Log warning but don't fail - env vars might be set elsewhere
			fmt.Printf("Warning: Could not load .env file: %v\n", err)
		}
	}

	// Try to read YAML config file (ignore if not found)
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	if err := viper.MergeInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Validate configuration
	if err := validate(&config); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &config, nil
}

// setDefaults sets default configuration values
func setDefaults() {
	// Application defaults
	viper.SetDefault("environment", "development")
	viper.SetDefault("version", "0.1.0")

	// Server defaults
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.read_timeout", 15)
	viper.SetDefault("server.write_timeout", 15)
	viper.SetDefault("server.idle_timeout", 60)
	viper.SetDefault("server.max_connections", 1000)

	// Database defaults
	viper.SetDefault("database.postgresql.host", "localhost")
	viper.SetDefault("database.postgresql.port", 5432)
	viper.SetDefault("database.postgresql.database", "universal_ai_tools")
	viper.SetDefault("database.postgresql.username", "postgres")
	viper.SetDefault("database.postgresql.ssl_mode", "prefer")
	viper.SetDefault("database.postgresql.max_connections", 25)
	viper.SetDefault("database.postgresql.min_connections", 5)
	viper.SetDefault("database.postgresql.max_connection_lifetime", "1h")
	viper.SetDefault("database.postgresql.max_connection_idle_time", "30m")

	viper.SetDefault("database.redis.host", "localhost")
	viper.SetDefault("database.redis.port", 6379)
	viper.SetDefault("database.redis.database", 0)
	viper.SetDefault("database.redis.max_connections", 10)
	viper.SetDefault("database.redis.min_idle_connections", 2)

	viper.SetDefault("database.neo4j.uri", "bolt://localhost:7687")
	viper.SetDefault("database.neo4j.username", "neo4j")
	viper.SetDefault("database.neo4j.max_connections", 10)

	// Security defaults
	viper.SetDefault("security.jwt_expiration", "24h")
	viper.SetDefault("security.bcrypt_cost", 12)
	viper.SetDefault("security.rate_limit_per_minute", 100)
	viper.SetDefault("security.cors_allowed_origins", []string{"*"})
	viper.SetDefault("security.require_auth", true)

	// Metrics defaults
	viper.SetDefault("metrics.enabled", true)
	viper.SetDefault("metrics.port", 9090)
	viper.SetDefault("metrics.path", "/metrics")

	// Health defaults
	viper.SetDefault("health.port", 8081)
	viper.SetDefault("health.path", "/health")

	// Migration defaults
	viper.SetDefault("migration.enable_compatibility_mode", true)
	viper.SetDefault("migration.typescript_endpoint", "http://localhost:9999")
	viper.SetDefault("migration.proxy_timeout", 30)
	viper.SetDefault("migration.enable_testing", true)

	// Rust AI defaults
	viper.SetDefault("rust_ai.endpoint", "http://localhost:8082")
	viper.SetDefault("rust_ai.grpc_port", 50051)
	viper.SetDefault("rust_ai.connection_timeout", "10s")
	viper.SetDefault("rust_ai.request_timeout", "30s")
	viper.SetDefault("rust_ai.max_retries", 3)

	// LM Studio defaults
	viper.SetDefault("lm_studio.endpoint", "http://localhost:5901/v1")
	viper.SetDefault("lm_studio.model", "qwen/qwen3-30b-a3b-2507")
	viper.SetDefault("lm_studio.enabled", true)

	// AppFlowy defaults
	viper.SetDefault("appflowy.endpoint", "https://beta.appflowy.cloud")
	viper.SetDefault("appflowy.timeout", "30s")
	viper.SetDefault("appflowy.max_retries", 3)
	viper.SetDefault("appflowy.enabled", true)
	viper.SetDefault("appflowy.mock_mode", true) // Start with mock mode until real API is configured

	// Logging defaults
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "json")
	viper.SetDefault("logging.enable_stack_trace", false)
	viper.SetDefault("logging.enable_caller", true)
}

// validate checks configuration values for correctness
func validate(cfg *Config) error {
	// Validate environment
	validEnvs := []string{"development", "staging", "production"}
	isValidEnv := false
	for _, env := range validEnvs {
		if cfg.Environment == env {
			isValidEnv = true
			break
		}
	}
	if !isValidEnv {
		return fmt.Errorf("invalid environment: %s (must be one of: %v)", cfg.Environment, validEnvs)
	}

	// Validate server configuration
	if cfg.Server.Port < 1 || cfg.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", cfg.Server.Port)
	}

	// Validate database configuration (allow empty for development mode)
	if cfg.Environment == "production" {
		if cfg.Database.PostgreSQL.Host == "" {
			return fmt.Errorf("PostgreSQL host cannot be empty in production")
		}
		if cfg.Database.PostgreSQL.Database == "" {
			return fmt.Errorf("PostgreSQL database name cannot be empty in production")
		}
	}

	// Validate security configuration
	if cfg.Security.JWTSecret == "" && cfg.Security.RequireAuth {
		return fmt.Errorf("JWT secret cannot be empty when authentication is required")
	}
	if cfg.Security.BCryptCost < 4 || cfg.Security.BCryptCost > 31 {
		return fmt.Errorf("invalid bcrypt cost: %d (must be between 4 and 31)", cfg.Security.BCryptCost)
	}

	// Validate logging configuration
	validLogLevels := []string{"debug", "info", "warn", "error"}
	isValidLogLevel := false
	for _, level := range validLogLevels {
		if cfg.Logging.Level == level {
			isValidLogLevel = true
			break
		}
	}
	if !isValidLogLevel {
		return fmt.Errorf("invalid log level: %s (must be one of: %v)", cfg.Logging.Level, validLogLevels)
	}

	return nil
}

// GetDSN returns the PostgreSQL connection string
func (c *PostgreSQLConfig) GetDSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.Username, c.Password, c.Database, c.SSLMode,
	)
}

// GetRedisAddr returns the Redis connection address
func (c *RedisConfig) GetRedisAddr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}
