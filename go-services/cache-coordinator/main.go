package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"github.com/universal-ai-tools/go-services/shared"
	"go.uber.org/zap"
)

type CacheCoordinator struct {
	config       *shared.Config
	logger       *zap.Logger
	redisClient  *redis.Client
	localCache   *LocalCache
	metrics      *CacheMetrics
	shutdownChan chan struct{}
}

type LocalCache struct {
	mu      sync.RWMutex
	data    map[string]*CacheItem
	maxSize int64
	size    int64
}

type CacheItem struct {
	Key         string
	Value       []byte
	Service     shared.ServiceType
	TTL         time.Duration
	CreatedAt   time.Time
	AccessCount int64
	Size        int64
}

type CacheMetrics struct {
	hits              *prometheus.CounterVec
	misses            *prometheus.CounterVec
	sets              *prometheus.CounterVec
	evictions         *prometheus.CounterVec
	localCacheSize    prometheus.Gauge
	redisCacheSize    prometheus.Gauge
	requestDuration   *prometheus.HistogramVec
}

func NewCacheMetrics() *CacheMetrics {
	return &CacheMetrics{
		hits: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "cache_hits_total",
				Help: "Total number of cache hits",
			},
			[]string{"service", "cache_type"},
		),
		misses: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "cache_misses_total",
				Help: "Total number of cache misses",
			},
			[]string{"service", "cache_type"},
		),
		sets: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "cache_sets_total",
				Help: "Total number of cache sets",
			},
			[]string{"service", "cache_type"},
		),
		evictions: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "cache_evictions_total",
				Help: "Total number of cache evictions",
			},
			[]string{"cache_type", "reason"},
		),
		localCacheSize: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "cache_local_size_bytes",
				Help: "Current size of local cache in bytes",
			},
		),
		redisCacheSize: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "cache_redis_size_bytes",
				Help: "Estimated size of Redis cache in bytes",
			},
		),
		requestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "cache_request_duration_seconds",
				Help:    "Cache request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"operation", "cache_type"},
		),
	}
}

func NewCacheCoordinator(config *shared.Config, logger *zap.Logger) (*CacheCoordinator, error) {
	// Initialize Redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr:     config.Redis.Addr,
		Password: config.Redis.Password,
		DB:       config.Redis.DB,
		PoolSize: config.Redis.PoolSize,
	})

	// Test Redis connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := redisClient.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	cc := &CacheCoordinator{
		config:      config,
		logger:      logger,
		redisClient: redisClient,
		localCache: &LocalCache{
			data:    make(map[string]*CacheItem),
			maxSize: 100 * 1024 * 1024, // 100MB default
		},
		metrics:      NewCacheMetrics(),
		shutdownChan: make(chan struct{}),
	}

	// Register metrics
	prometheus.MustRegister(
		cc.metrics.hits,
		cc.metrics.misses,
		cc.metrics.sets,
		cc.metrics.evictions,
		cc.metrics.localCacheSize,
		cc.metrics.redisCacheSize,
		cc.metrics.requestDuration,
	)

	return cc, nil
}

func (cc *CacheCoordinator) Start() error {
	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Cache operations
	router.GET("/cache/:key", cc.getHandler)
	router.POST("/cache/:key", cc.setHandler)
	router.DELETE("/cache/:key", cc.deleteHandler)
	router.POST("/cache/batch", cc.batchGetHandler)
	
	// Cache management
	router.GET("/cache/stats", cc.statsHandler)
	router.POST("/cache/invalidate", cc.invalidateHandler)
	router.POST("/cache/warm", cc.warmCacheHandler)

	// Health check
	router.GET("/health", cc.healthCheckHandler)

	// Metrics endpoint
	if cc.config.Metrics.Enabled {
		router.GET(cc.config.Metrics.Path, gin.WrapH(promhttp.Handler()))
	}

	// Start background tasks
	go cc.startEvictionTask()
	go cc.startMetricsUpdater()

	// Start HTTP server
	srv := &http.Server{
		Addr:    ":" + cc.config.HTTP.Port,
		Handler: router,
	}

	go func() {
		cc.logger.Info("Starting cache coordinator", zap.String("port", cc.config.HTTP.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			cc.logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	cc.logger.Info("Shutting down cache coordinator")
	close(cc.shutdownChan)

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cc.redisClient.Close()
	return srv.Shutdown(ctx)
}

func (cc *CacheCoordinator) getHandler(c *gin.Context) {
	start := time.Now()
	key := c.Param("key")
	service := shared.ServiceType(c.GetHeader("X-Service-Type"))

	// Try local cache first
	if value, found := cc.getFromLocal(key, service); found {
		cc.metrics.hits.WithLabelValues(string(service), "local").Inc()
		cc.metrics.requestDuration.WithLabelValues("get", "local").Observe(time.Since(start).Seconds())
		
		c.Data(http.StatusOK, "application/octet-stream", value)
		return
	}

	// Try Redis
	ctx := context.Background()
	value, err := cc.redisClient.Get(ctx, cc.buildRedisKey(key, service)).Bytes()
	if err == nil {
		cc.metrics.hits.WithLabelValues(string(service), "redis").Inc()
		cc.metrics.requestDuration.WithLabelValues("get", "redis").Observe(time.Since(start).Seconds())
		
		// Store in local cache for future hits
		cc.setInLocal(key, value, service, 5*time.Minute)
		
		c.Data(http.StatusOK, "application/octet-stream", value)
		return
	}

	// Cache miss
	cc.metrics.misses.WithLabelValues(string(service), "all").Inc()
	cc.metrics.requestDuration.WithLabelValues("get", "miss").Observe(time.Since(start).Seconds())
	
	c.JSON(http.StatusNotFound, gin.H{"error": "key not found"})
}

func (cc *CacheCoordinator) setHandler(c *gin.Context) {
	start := time.Now()
	key := c.Param("key")
	service := shared.ServiceType(c.GetHeader("X-Service-Type"))
	
	// Parse request body
	var req struct {
		Value json.RawMessage `json:"value"`
		TTL   int            `json:"ttl"` // seconds
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ttl := time.Duration(req.TTL) * time.Second
	if ttl == 0 {
		ttl = 1 * time.Hour // Default TTL
	}

	// Store in both local and Redis
	value, _ := req.Value.MarshalJSON()
	
	// Store in Redis
	ctx := context.Background()
	redisKey := cc.buildRedisKey(key, service)
	if err := cc.redisClient.Set(ctx, redisKey, value, ttl).Err(); err != nil {
		cc.logger.Error("Failed to set in Redis", zap.Error(err))
	} else {
		cc.metrics.sets.WithLabelValues(string(service), "redis").Inc()
	}

	// Store in local cache
	cc.setInLocal(key, value, service, ttl)
	cc.metrics.sets.WithLabelValues(string(service), "local").Inc()
	
	cc.metrics.requestDuration.WithLabelValues("set", "all").Observe(time.Since(start).Seconds())
	
	c.JSON(http.StatusOK, gin.H{"status": "cached"})
}

func (cc *CacheCoordinator) deleteHandler(c *gin.Context) {
	key := c.Param("key")
	service := shared.ServiceType(c.GetHeader("X-Service-Type"))

	// Delete from local cache
	cc.deleteFromLocal(key, service)

	// Delete from Redis
	ctx := context.Background()
	redisKey := cc.buildRedisKey(key, service)
	cc.redisClient.Del(ctx, redisKey)

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (cc *CacheCoordinator) batchGetHandler(c *gin.Context) {
	var req struct {
		Keys    []string           `json:"keys"`
		Service shared.ServiceType `json:"service"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results := make(map[string]json.RawMessage)
	
	// Try local cache first
	localMisses := []string{}
	for _, key := range req.Keys {
		if value, found := cc.getFromLocal(key, req.Service); found {
			results[key] = json.RawMessage(value)
			cc.metrics.hits.WithLabelValues(string(req.Service), "local").Inc()
		} else {
			localMisses = append(localMisses, key)
		}
	}

	// Try Redis for misses
	if len(localMisses) > 0 {
		ctx := context.Background()
		pipe := cc.redisClient.Pipeline()
		
		cmds := make(map[string]*redis.StringCmd)
		for _, key := range localMisses {
			redisKey := cc.buildRedisKey(key, req.Service)
			cmds[key] = pipe.Get(ctx, redisKey)
		}
		
		pipe.Exec(ctx)
		
		for key, cmd := range cmds {
			if value, err := cmd.Bytes(); err == nil {
				results[key] = json.RawMessage(value)
				cc.metrics.hits.WithLabelValues(string(req.Service), "redis").Inc()
				
				// Store in local cache
				cc.setInLocal(key, value, req.Service, 5*time.Minute)
			} else {
				cc.metrics.misses.WithLabelValues(string(req.Service), "all").Inc()
			}
		}
	}

	c.JSON(http.StatusOK, results)
}

func (cc *CacheCoordinator) invalidateHandler(c *gin.Context) {
	var req struct {
		Pattern string             `json:"pattern"`
		Service shared.ServiceType `json:"service"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	count := cc.invalidatePattern(req.Pattern, req.Service)
	
	c.JSON(http.StatusOK, gin.H{
		"status":      "invalidated",
		"keys_removed": count,
	})
}

func (cc *CacheCoordinator) warmCacheHandler(c *gin.Context) {
	var req struct {
		Service shared.ServiceType      `json:"service"`
		Data    map[string]json.RawMessage `json:"data"`
		TTL     int                     `json:"ttl"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ttl := time.Duration(req.TTL) * time.Second
	if ttl == 0 {
		ttl = 1 * time.Hour
	}

	count := 0
	for key, value := range req.Data {
		data, _ := value.MarshalJSON()
		cc.setInLocal(key, data, req.Service, ttl)
		
		// Also store in Redis
		ctx := context.Background()
		redisKey := cc.buildRedisKey(key, req.Service)
		cc.redisClient.Set(ctx, redisKey, data, ttl)
		
		count++
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "warmed",
		"keys_loaded": count,
	})
}

func (cc *CacheCoordinator) statsHandler(c *gin.Context) {
	cc.localCache.mu.RLock()
	localStats := map[string]interface{}{
		"items": len(cc.localCache.data),
		"size":  cc.localCache.size,
		"max_size": cc.localCache.maxSize,
	}
	cc.localCache.mu.RUnlock()

	// Get Redis stats
	ctx := context.Background()
	info := cc.redisClient.Info(ctx, "memory").Val()
	
	c.JSON(http.StatusOK, gin.H{
		"local_cache": localStats,
		"redis_info":  info,
	})
}

func (cc *CacheCoordinator) healthCheckHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	redisHealthy := cc.redisClient.Ping(ctx).Err() == nil

	status := "healthy"
	if !redisHealthy {
		status = "degraded"
	}

	c.JSON(http.StatusOK, gin.H{
		"status": status,
		"service": "cache-coordinator",
		"redis_connected": redisHealthy,
		"local_cache_size": cc.localCache.size,
	})
}

// Local cache operations
func (cc *CacheCoordinator) getFromLocal(key string, service shared.ServiceType) ([]byte, bool) {
	cc.localCache.mu.RLock()
	defer cc.localCache.mu.RUnlock()

	fullKey := cc.buildLocalKey(key, service)
	if item, exists := cc.localCache.data[fullKey]; exists {
		if time.Since(item.CreatedAt) < item.TTL {
			atomic.AddInt64(&item.AccessCount, 1)
			return item.Value, true
		}
		// Expired
		delete(cc.localCache.data, fullKey)
		atomic.AddInt64(&cc.localCache.size, -item.Size)
	}
	return nil, false
}

func (cc *CacheCoordinator) setInLocal(key string, value []byte, service shared.ServiceType, ttl time.Duration) {
	cc.localCache.mu.Lock()
	defer cc.localCache.mu.Unlock()

	fullKey := cc.buildLocalKey(key, service)
	size := int64(len(value))

	// Check if we need to evict
	if cc.localCache.size+size > cc.localCache.maxSize {
		cc.evictLRU()
	}

	item := &CacheItem{
		Key:       key,
		Value:     value,
		Service:   service,
		TTL:       ttl,
		CreatedAt: time.Now(),
		Size:      size,
	}

	if old, exists := cc.localCache.data[fullKey]; exists {
		atomic.AddInt64(&cc.localCache.size, -(old.Size - size))
	} else {
		atomic.AddInt64(&cc.localCache.size, size)
	}

	cc.localCache.data[fullKey] = item
	cc.metrics.localCacheSize.Set(float64(cc.localCache.size))
}

func (cc *CacheCoordinator) deleteFromLocal(key string, service shared.ServiceType) {
	cc.localCache.mu.Lock()
	defer cc.localCache.mu.Unlock()

	fullKey := cc.buildLocalKey(key, service)
	if item, exists := cc.localCache.data[fullKey]; exists {
		delete(cc.localCache.data, fullKey)
		atomic.AddInt64(&cc.localCache.size, -item.Size)
		cc.metrics.localCacheSize.Set(float64(cc.localCache.size))
	}
}

func (cc *CacheCoordinator) evictLRU() {
	// Find least recently used item
	var lruKey string
	var lruItem *CacheItem
	minAccess := int64(^uint64(0) >> 1) // Max int64

	for key, item := range cc.localCache.data {
		if item.AccessCount < minAccess {
			minAccess = item.AccessCount
			lruKey = key
			lruItem = item
		}
	}

	if lruKey != "" {
		delete(cc.localCache.data, lruKey)
		atomic.AddInt64(&cc.localCache.size, -lruItem.Size)
		cc.metrics.evictions.WithLabelValues("local", "lru").Inc()
	}
}

func (cc *CacheCoordinator) invalidatePattern(pattern string, service shared.ServiceType) int {
	cc.localCache.mu.Lock()
	defer cc.localCache.mu.Unlock()

	count := 0
	prefix := fmt.Sprintf("%s:", service)
	
	for key, item := range cc.localCache.data {
		if len(pattern) > 0 {
			// Simple pattern matching (could be enhanced)
			if key == prefix+pattern || key == pattern {
				delete(cc.localCache.data, key)
				atomic.AddInt64(&cc.localCache.size, -item.Size)
				count++
			}
		}
	}

	cc.metrics.localCacheSize.Set(float64(cc.localCache.size))
	return count
}

func (cc *CacheCoordinator) buildLocalKey(key string, service shared.ServiceType) string {
	return fmt.Sprintf("%s:%s", service, key)
}

func (cc *CacheCoordinator) buildRedisKey(key string, service shared.ServiceType) string {
	return fmt.Sprintf("cache:%s:%s", service, key)
}

func (cc *CacheCoordinator) startEvictionTask() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			cc.evictExpired()
		case <-cc.shutdownChan:
			return
		}
	}
}

func (cc *CacheCoordinator) evictExpired() {
	cc.localCache.mu.Lock()
	defer cc.localCache.mu.Unlock()

	now := time.Now()
	for key, item := range cc.localCache.data {
		if now.Sub(item.CreatedAt) > item.TTL {
			delete(cc.localCache.data, key)
			atomic.AddInt64(&cc.localCache.size, -item.Size)
			cc.metrics.evictions.WithLabelValues("local", "expired").Inc()
		}
	}

	cc.metrics.localCacheSize.Set(float64(cc.localCache.size))
}

func (cc *CacheCoordinator) startMetricsUpdater() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Update Redis size estimate
			ctx := context.Background()
			if info := cc.redisClient.Info(ctx, "memory"); info.Err() == nil {
				// Parse used_memory_rss from info
				// This is simplified - in production, parse the actual value
				cc.metrics.redisCacheSize.Set(0) // Placeholder
			}
		case <-cc.shutdownChan:
			return
		}
	}
}

func main() {
	// Load configuration
	config, err := shared.LoadConfig("config.yaml")
	if err != nil {
		config = &shared.Config{
			Service: shared.ServiceConfig{
				Name:     "cache-coordinator",
				LogLevel: "info",
			},
			HTTP: shared.HTTPConfig{
				Port: "8083",
			},
			Redis: shared.RedisConfig{
				Addr:     "localhost:6379",
				DB:       0,
				PoolSize: 10,
			},
		}
	}

	// Setup logger
	logger, err := shared.SetupLogger(config.Service.LogLevel)
	if err != nil {
		panic(fmt.Sprintf("Failed to setup logger: %v", err))
	}

	// Create and start cache coordinator
	cc, err := NewCacheCoordinator(config, logger)
	if err != nil {
		logger.Fatal("Failed to create cache coordinator", zap.Error(err))
	}

	if err := cc.Start(); err != nil {
		logger.Fatal("Failed to start cache coordinator", zap.Error(err))
	}
}