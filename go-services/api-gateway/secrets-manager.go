package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// SecretsManager handles Supabase Vault integration
type SecretsManager struct {
	supabaseURL   string
	supabaseKey   string
	cache         map[string]string
	cacheExpiry   time.Time
	cacheDuration time.Duration
}

// Secret represents a secret from Supabase Vault
type Secret struct {
	Name        string    `json:"name"`
	Value       string    `json:"value"`
	Description string    `json:"description,omitempty"`
	Service     string    `json:"service,omitempty"`
	ExpiresAt   time.Time `json:"expires_at,omitempty"`
}

// NewSecretsManager creates a new secrets manager instance
func NewSecretsManager() *SecretsManager {
	return &SecretsManager{
		supabaseURL:   getEnvOrDefault("SUPABASE_URL", "http://localhost:54321"),
		supabaseKey:   getEnvOrDefault("SUPABASE_SERVICE_KEY", ""),
		cache:         make(map[string]string),
		cacheDuration: 5 * time.Minute,
	}
}

// GetSecret retrieves a secret from Supabase Vault with caching
func (sm *SecretsManager) GetSecret(name string) (string, error) {
	// Check cache first
	if time.Now().Before(sm.cacheExpiry) {
		if value, exists := sm.cache[name]; exists {
			return value, nil
		}
	}

	// Fetch from Supabase Vault
	value, err := sm.fetchFromVault(name)
	if err != nil {
		// Fallback to environment variable
		envValue := os.Getenv(name)
		if envValue != "" {
			log.Printf("Using environment fallback for secret: %s", name)
			return envValue, nil
		}
		return "", fmt.Errorf("secret %s not found in vault or environment", name)
	}

	// Update cache
	sm.cache[name] = value
	sm.cacheExpiry = time.Now().Add(sm.cacheDuration)

	return value, nil
}

// fetchFromVault retrieves a secret from Supabase Vault
func (sm *SecretsManager) fetchFromVault(name string) (string, error) {
	if sm.supabaseKey == "" {
		return "", fmt.Errorf("supabase service key not configured")
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Build request URL
	url := fmt.Sprintf("%s/rest/v1/secrets?name=eq.%s", sm.supabaseURL, name)

	// Create request
	req, err := http.NewRequestWithContext(context.Background(), "GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("apikey", sm.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+sm.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	// Make request
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch secret: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("supabase vault returned status %d", resp.StatusCode)
	}

	// Parse response
	var secrets []Secret
	if err := json.NewDecoder(resp.Body).Decode(&secrets); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(secrets) == 0 {
		return "", fmt.Errorf("secret %s not found", name)
	}

	return secrets[0].Value, nil
}

// StoreSecret stores a secret in Supabase Vault
func (sm *SecretsManager) StoreSecret(secret Secret) error {
	if sm.supabaseKey == "" {
		return fmt.Errorf("supabase service key not configured")
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Build request URL
	url := fmt.Sprintf("%s/rest/v1/secrets", sm.supabaseURL)

	// Create request body
	body, err := json.Marshal(secret)
	if err != nil {
		return fmt.Errorf("failed to marshal secret: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(context.Background(), "POST", url, strings.NewReader(string(body)))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("apikey", sm.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+sm.supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	// Make request
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to store secret: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("supabase vault returned status %d", resp.StatusCode)
	}

	// Clear cache to force refresh
	sm.cache = make(map[string]string)
	sm.cacheExpiry = time.Time{}

	return nil
}

// ValidateAPIKey validates an API key against Supabase Vault
func (sm *SecretsManager) ValidateAPIKey(apiKey string) bool {
	validKey, err := sm.GetSecret("API_KEY")
	if err != nil {
		log.Printf("Failed to get API_KEY from vault: %v", err)
		// Fallback to environment variable
		validKey = os.Getenv("API_KEY")
		if validKey == "" {
			log.Printf("CRITICAL: No API_KEY configured in vault or environment")
			return false // SECURITY: No fallback to hardcoded keys
		}
	}
	return apiKey == validKey
}

// ValidateJWTSecret validates JWT secret against Supabase Vault
func (sm *SecretsManager) ValidateJWTSecret() (string, error) {
	return sm.GetSecret("JWT_SECRET")
}

// GetOpenAIKey retrieves OpenAI API key from Supabase Vault
func (sm *SecretsManager) GetOpenAIKey() (string, error) {
	return sm.GetSecret("OPENAI_API_KEY")
}

// GetAnthropicKey retrieves Anthropic API key from Supabase Vault
func (sm *SecretsManager) GetAnthropicKey() (string, error) {
	return sm.GetSecret("ANTHROPIC_API_KEY")
}

// InitializeSecrets initializes common secrets in Supabase Vault
func (sm *SecretsManager) InitializeSecrets() error {
	secrets := []Secret{
		{
			Name:        "API_KEY",
			Value:       getEnvOrDefault("API_KEY", "local-dev-key"),
			Description: "Main API key for service authentication",
			Service:     "api-gateway",
		},
		{
			Name:        "JWT_SECRET",
			Value:       getEnvOrDefault("JWT_SECRET", "your-super-secret-jwt-token-with-at-least-32-characters-long"),
			Description: "JWT signing secret",
			Service:     "auth-service",
		},
		{
			Name:        "OPENAI_API_KEY",
			Value:       getEnvOrDefault("OPENAI_API_KEY", ""),
			Description: "OpenAI API key for LLM services",
			Service:     "llm-router",
		},
		{
			Name:        "ANTHROPIC_API_KEY",
			Value:       getEnvOrDefault("ANTHROPIC_API_KEY", ""),
			Description: "Anthropic API key for Claude services",
			Service:     "llm-router",
		},
	}

	for _, secret := range secrets {
		if err := sm.StoreSecret(secret); err != nil {
			log.Printf("Failed to store secret %s: %v", secret.Name, err)
		} else {
			log.Printf("Stored secret: %s", secret.Name)
		}
	}

	return nil
}
