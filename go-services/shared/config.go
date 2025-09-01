package shared

import (
	"github.com/spf13/viper"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Config holds the configuration for all Go services
type Config struct {
	Service ServiceConfig `mapstructure:"service"`
	NATS    NATSConfig    `mapstructure:"nats"`
	Redis   RedisConfig   `mapstructure:"redis"`
	HTTP    HTTPConfig    `mapstructure:"http"`
	Rust    RustConfig    `mapstructure:"rust"`
	NodeJS  NodeJSConfig  `mapstructure:"nodejs"`
	Metrics MetricsConfig `mapstructure:"metrics"`
}

type ServiceConfig struct {
	Name        string `mapstructure:"name"`
	Environment string `mapstructure:"environment"`
	LogLevel    string `mapstructure:"log_level"`
	Version     string `mapstructure:"version"`
}

type NATSConfig struct {
	URL           string `mapstructure:"url"`
	ClusterID     string `mapstructure:"cluster_id"`
	ClientID      string `mapstructure:"client_id"`
	MaxReconnects int    `mapstructure:"max_reconnects"`
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	PoolSize int    `mapstructure:"pool_size"`
}

type HTTPConfig struct {
	Port            string `mapstructure:"port"`
	ReadTimeout     int    `mapstructure:"read_timeout"`
	WriteTimeout    int    `mapstructure:"write_timeout"`
	MaxHeaderBytes  int    `mapstructure:"max_header_bytes"`
	TrustedProxies  []string `mapstructure:"trusted_proxies"`
}

type RustConfig struct {
	VisionServiceURL    string `mapstructure:"vision_service_url"`
	AIServiceURL        string `mapstructure:"ai_service_url"`
	AnalyticsServiceURL string `mapstructure:"analytics_service_url"`
	HealthCheckInterval int    `mapstructure:"health_check_interval"`
	RequestTimeout      int    `mapstructure:"request_timeout"`
}

type NodeJSConfig struct {
	BackendURL     string `mapstructure:"backend_url"`
	WebSocketURL   string `mapstructure:"websocket_url"`
	RequestTimeout int    `mapstructure:"request_timeout"`
}

type MetricsConfig struct {
	Enabled bool   `mapstructure:"enabled"`
	Port    string `mapstructure:"port"`
	Path    string `mapstructure:"path"`
}

// LoadConfig loads configuration from file and environment
func LoadConfig(configPath string) (*Config, error) {
	viper.SetConfigFile(configPath)
	viper.SetConfigType("yaml")
	viper.AutomaticEnv()

	// Set defaults
	viper.SetDefault("service.environment", "development")
	viper.SetDefault("service.log_level", "info")
	viper.SetDefault("nats.url", "nats://localhost:4222")
	viper.SetDefault("redis.addr", "localhost:6379")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.pool_size", 10)
	viper.SetDefault("http.port", "8080")
	viper.SetDefault("http.read_timeout", 30)
	viper.SetDefault("http.write_timeout", 30)
	viper.SetDefault("rust.health_check_interval", 30)
	viper.SetDefault("rust.request_timeout", 30)
	viper.SetDefault("nodejs.backend_url", "http://localhost:9999")
	viper.SetDefault("nodejs.request_timeout", 30)
	viper.SetDefault("metrics.enabled", true)
	viper.SetDefault("metrics.port", "9090")
	viper.SetDefault("metrics.path", "/metrics")

	if err := viper.ReadInConfig(); err != nil {
		// Config file not found; use defaults
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, err
	}

	return &config, nil
}

// SetupLogger configures zap logger
func SetupLogger(logLevel string) (*zap.Logger, error) {
	var level zapcore.Level
	if err := level.UnmarshalText([]byte(logLevel)); err != nil {
		level = zapcore.InfoLevel
	}

	config := zap.Config{
		Level:            zap.NewAtomicLevelAt(level),
		Development:      level == zapcore.DebugLevel,
		Encoding:         "json",
		EncoderConfig:    zap.NewProductionEncoderConfig(),
		OutputPaths:      []string{"stdout"},
		ErrorOutputPaths: []string{"stderr"},
	}

	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	return config.Build()
}