// Redis caching service for Universal AI Tools Go API Gateway
// Implements high-performance caching for LLM responses, vision processing, and agent results

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"universal-ai-tools/go-api-gateway/internal/config"
)

// CacheEntry represents a cached item with metadata
type CacheEntry struct {
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
	TTL       int64       `json:"ttl"`
	Size      int         `json:"size"`
}

// RedisService provides high-performance Redis caching capabilities
type RedisService struct {
	client     *redis.Client
	config     *config.Config
	logger     *zap.Logger
	hitCount   int64
	missCount  int64
	errorCount int64
}

// NewRedisService creates a new Redis caching service
func NewRedisService(cfg *config.Config, logger *zap.Logger) (*RedisService, error) {
	// Redis configuration with optimized settings
	rdb := redis.NewClient(&redis.Options{
		Addr:         "localhost:6379",
		Password:     "", // No password for local development
		DB:           0,  // Default DB
		PoolSize:     10, // Connection pool size
		MinIdleConns: 5,  // Minimum idle connections
		MaxRetries:   3,  // Retry failed operations
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		PoolTimeout:  30 * time.Second,
	})

	// Test Redis connectivity
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		logger.Error("Failed to connect to Redis", zap.Error(err))
		return nil, fmt.Errorf("Redis connection failed: %w", err)
	}

	logger.Info("✅ Redis service initialized successfully")

	return &RedisService{
		client: rdb,
		config: cfg,
		logger: logger.With(zap.String("service", "redis")),
	}, nil
}

// SetLLMResponse caches LLM response with optimized TTL
func (r *RedisService) SetLLMResponse(prompt string, response string, model string, ttl time.Duration) error {
	key := r.buildLLMKey(prompt, model)
	
	entry := CacheEntry{
		Data:      response,
		Timestamp: time.Now(),
		TTL:       int64(ttl.Seconds()),
		Size:      len(response),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		r.errorCount++
		return fmt.Errorf("failed to marshal cache entry: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = r.client.Set(ctx, key, data, ttl).Err()
	if err != nil {
		r.errorCount++
		r.logger.Error("Failed to cache LLM response", zap.String("key", key), zap.Error(err))
		return err
	}

	r.logger.Debug("Cached LLM response", 
		zap.String("model", model),
		zap.Int("response_size", len(response)),
		zap.Duration("ttl", ttl))

	return nil
}

// GetLLMResponse retrieves cached LLM response
func (r *RedisService) GetLLMResponse(prompt string, model string) (string, bool, error) {
	key := r.buildLLMKey(prompt, model)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	data, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		r.missCount++
		return "", false, nil // Cache miss
	}
	if err != nil {
		r.errorCount++
		r.logger.Error("Failed to get cached LLM response", zap.String("key", key), zap.Error(err))
		return "", false, err
	}

	var entry CacheEntry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		r.errorCount++
		return "", false, fmt.Errorf("failed to unmarshal cache entry: %w", err)
	}

	response, ok := entry.Data.(string)
	if !ok {
		r.errorCount++
		return "", false, fmt.Errorf("cached data is not a string")
	}

	r.hitCount++
	r.logger.Debug("Cache hit for LLM response",
		zap.String("model", model),
		zap.Time("cached_at", entry.Timestamp))

	return response, true, nil
}

// SetVisionResult caches vision processing results
func (r *RedisService) SetVisionResult(imageHash string, question string, result interface{}, ttl time.Duration) error {
	key := r.buildVisionKey(imageHash, question)
	
	entry := CacheEntry{
		Data:      result,
		Timestamp: time.Now(),
		TTL:       int64(ttl.Seconds()),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		r.errorCount++
		return fmt.Errorf("failed to marshal vision result: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = r.client.Set(ctx, key, data, ttl).Err()
	if err != nil {
		r.errorCount++
		return err
	}

	r.logger.Debug("Cached vision result", 
		zap.String("image_hash", imageHash[:8]+"..."),
		zap.Duration("ttl", ttl))

	return nil
}

// GetVisionResult retrieves cached vision processing results
func (r *RedisService) GetVisionResult(imageHash string, question string) (interface{}, bool, error) {
	key := r.buildVisionKey(imageHash, question)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	data, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		r.missCount++
		return nil, false, nil
	}
	if err != nil {
		r.errorCount++
		return nil, false, err
	}

	var entry CacheEntry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		r.errorCount++
		return nil, false, err
	}

	r.hitCount++
	return entry.Data, true, nil
}

// SetAgentResult caches agent execution results
func (r *RedisService) SetAgentResult(agentID string, input string, result interface{}, ttl time.Duration) error {
	key := r.buildAgentKey(agentID, input)
	
	entry := CacheEntry{
		Data:      result,
		Timestamp: time.Now(),
		TTL:       int64(ttl.Seconds()),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		r.errorCount++
		return fmt.Errorf("failed to marshal agent result: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return r.client.Set(ctx, key, data, ttl).Err()
}

// GetAgentResult retrieves cached agent execution results
func (r *RedisService) GetAgentResult(agentID string, input string) (interface{}, bool, error) {
	key := r.buildAgentKey(agentID, input)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	data, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		r.missCount++
		return nil, false, nil
	}
	if err != nil {
		r.errorCount++
		return nil, false, err
	}

	var entry CacheEntry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		r.errorCount++
		return nil, false, err
	}

	r.hitCount++
	return entry.Data, true, nil
}

// InvalidatePattern removes cache entries matching a pattern
func (r *RedisService) InvalidatePattern(pattern string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		r.errorCount++
		return err
	}

	if len(keys) == 0 {
		return nil
	}

	err = r.client.Del(ctx, keys...).Err()
	if err != nil {
		r.errorCount++
		return err
	}

	r.logger.Info("Invalidated cache entries", 
		zap.String("pattern", pattern),
		zap.Int("count", len(keys)))

	return nil
}

// GetStats returns cache performance statistics
func (r *RedisService) GetStats() map[string]interface{} {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	info, _ := r.client.Info(ctx, "memory").Result()
	keyspace, _ := r.client.Info(ctx, "keyspace").Result()

	total := r.hitCount + r.missCount
	hitRate := float64(0)
	if total > 0 {
		hitRate = float64(r.hitCount) / float64(total) * 100
	}

	return map[string]interface{}{
		"hit_count":    r.hitCount,
		"miss_count":   r.missCount,
		"error_count":  r.errorCount,
		"hit_rate":     fmt.Sprintf("%.2f%%", hitRate),
		"memory_info":  info,
		"keyspace":     keyspace,
	}
}

// CleanupExpired removes expired test keys and optimizes memory
func (r *RedisService) CleanupExpired() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Remove test load keys that are likely from previous testing
	testKeys, err := r.client.Keys(ctx, "test:load:*").Result()
	if err == nil && len(testKeys) > 0 {
		deleted, err := r.client.Del(ctx, testKeys...).Result()
		if err == nil {
			r.logger.Info("Cleaned up test keys", zap.Int64("deleted", deleted))
		}
	}

	return nil
}

// buildLLMKey creates a cache key for LLM responses
func (r *RedisService) buildLLMKey(prompt string, model string) string {
	// Use SHA256 hash for long prompts to avoid key size issues
	return fmt.Sprintf("llm:%s:%x", model, r.hashString(prompt))
}

// buildVisionKey creates a cache key for vision results
func (r *RedisService) buildVisionKey(imageHash string, question string) string {
	return fmt.Sprintf("vision:%s:%x", imageHash, r.hashString(question))
}

// buildAgentKey creates a cache key for agent results
func (r *RedisService) buildAgentKey(agentID string, input string) string {
	return fmt.Sprintf("agent:%s:%x", agentID, r.hashString(input))
}

// hashString creates a consistent hash for cache keys
func (r *RedisService) hashString(input string) uint32 {
	hash := uint32(2166136261) // FNV-1a 32-bit offset basis
	for _, b := range []byte(input) {
		hash ^= uint32(b)
		hash *= 16777619 // FNV-1a 32-bit prime
	}
	return hash
}

// GetClient returns the underlying Redis client for use by other services
func (r *RedisService) GetClient() redis.Cmdable {
	return r.client
}

// Close closes the Redis connection
func (r *RedisService) Close() error {
	return r.client.Close()
}