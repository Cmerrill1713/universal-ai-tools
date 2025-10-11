package config

import (
	"os"
)

// Config holds the application configuration
type Config struct {
	WeaviateURL      string
	WeaviateAPIKey   string
	WeaviateHost     string
	WeaviateScheme   string
	WeaviatePort     string
	ServerPort       string
	OpenAIAPIKey     string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	return &Config{
		WeaviateURL:      getEnvOrDefault("WEAVIATE_URL", "http://localhost:8090"),
		WeaviateAPIKey:   os.Getenv("WEAVIATE_API_KEY"),
		WeaviateHost:     getEnvOrDefault("WEAVIATE_HOST", "localhost"),
		WeaviateScheme:   getEnvOrDefault("WEAVIATE_SCHEME", "http"),
		WeaviatePort:     getEnvOrDefault("WEAVIATE_PORT", "8090"),
		ServerPort:       getEnvOrDefault("WEAVIATE_CLIENT_PORT", "8019"),
		OpenAIAPIKey:     os.Getenv("OPENAI_API_KEY"),
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
