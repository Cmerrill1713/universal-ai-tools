package main

import (
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

// SharedMemoryManager manages shared memory operations
type SharedMemoryManager struct {
	mu      sync.RWMutex
	buffers map[string]*SharedBuffer
	metrics *MemoryMetrics
	logger  *zap.Logger
}

// SharedBuffer represents a shared memory buffer
type SharedBuffer struct {
	Name     string    `json:"name"`
	Size     int64     `json:"size"`
	Data     []byte    `json:"data"`
	Created  time.Time `json:"created"`
	LastUsed time.Time `json:"last_used"`
}

// MemoryMetrics tracks memory usage metrics
type MemoryMetrics struct {
	totalBuffers    prometheus.Gauge
	totalMemory     prometheus.Gauge
	activeBuffers   prometheus.Gauge
	memoryAllocated prometheus.Counter
	memoryFreed     prometheus.Counter
	operationsTotal prometheus.Counter
}

// NewSharedMemoryManager creates a new shared memory manager
func NewSharedMemoryManager() *SharedMemoryManager {
	logger, _ := zap.NewProduction()

	metrics := &MemoryMetrics{
		totalBuffers: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "shared_memory_total_buffers",
			Help: "Total number of shared memory buffers",
		}),
		totalMemory: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "shared_memory_total_memory_bytes",
			Help: "Total memory allocated in bytes",
		}),
		activeBuffers: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "shared_memory_active_buffers",
			Help: "Number of active memory buffers",
		}),
		memoryAllocated: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "shared_memory_allocated_total",
			Help: "Total memory allocated",
		}),
		memoryFreed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "shared_memory_freed_total",
			Help: "Total memory freed",
		}),
		operationsTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "shared_memory_operations_total",
			Help: "Total memory operations",
		}),
	}

	prometheus.MustRegister(metrics.totalBuffers)
	prometheus.MustRegister(metrics.totalMemory)
	prometheus.MustRegister(metrics.activeBuffers)
	prometheus.MustRegister(metrics.memoryAllocated)
	prometheus.MustRegister(metrics.memoryFreed)
	prometheus.MustRegister(metrics.operationsTotal)

	return &SharedMemoryManager{
		buffers: make(map[string]*SharedBuffer),
		metrics: metrics,
		logger:  logger,
	}
}

// CreateBuffer creates a new shared memory buffer
func (sm *SharedMemoryManager) CreateBuffer(name string, size int64) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if _, exists := sm.buffers[name]; exists {
		return fmt.Errorf("buffer %s already exists", name)
	}

	buffer := &SharedBuffer{
		Name:     name,
		Size:     size,
		Data:     make([]byte, size),
		Created:  time.Now(),
		LastUsed: time.Now(),
	}

	sm.buffers[name] = buffer
	sm.metrics.totalBuffers.Inc()
	sm.metrics.totalMemory.Add(float64(size))
	sm.metrics.memoryAllocated.Add(float64(size))
	sm.metrics.operationsTotal.Inc()

	sm.logger.Info("Created shared memory buffer",
		zap.String("name", name),
		zap.Int64("size", size))

	return nil
}

// ReadBuffer reads data from a shared memory buffer
func (sm *SharedMemoryManager) ReadBuffer(name string, offset int64, length int64) ([]byte, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	buffer, exists := sm.buffers[name]
	if !exists {
		return nil, fmt.Errorf("buffer %s not found", name)
	}

	if offset < 0 || offset >= int64(len(buffer.Data)) {
		return nil, fmt.Errorf("offset out of bounds")
	}

	end := offset + length
	if end > int64(len(buffer.Data)) {
		end = int64(len(buffer.Data))
	}

	buffer.LastUsed = time.Now()
	sm.metrics.operationsTotal.Inc()

	return buffer.Data[offset:end], nil
}

// WriteBuffer writes data to a shared memory buffer
func (sm *SharedMemoryManager) WriteBuffer(name string, offset int64, data []byte) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	buffer, exists := sm.buffers[name]
	if !exists {
		return fmt.Errorf("buffer %s not found", name)
	}

	if offset < 0 || offset >= int64(len(buffer.Data)) {
		return fmt.Errorf("offset out of bounds")
	}

	end := offset + int64(len(data))
	if end > int64(len(buffer.Data)) {
		return fmt.Errorf("data exceeds buffer size")
	}

	copy(buffer.Data[offset:end], data)
	buffer.LastUsed = time.Now()
	sm.metrics.operationsTotal.Inc()

	sm.logger.Debug("Wrote to shared memory buffer",
		zap.String("name", name),
		zap.Int64("offset", offset),
		zap.Int("length", len(data)))

	return nil
}

// DeleteBuffer deletes a shared memory buffer
func (sm *SharedMemoryManager) DeleteBuffer(name string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	buffer, exists := sm.buffers[name]
	if !exists {
		return fmt.Errorf("buffer %s not found", name)
	}

	sm.metrics.totalBuffers.Dec()
	sm.metrics.totalMemory.Sub(float64(buffer.Size))
	sm.metrics.memoryFreed.Add(float64(buffer.Size))
	sm.metrics.operationsTotal.Inc()

	delete(sm.buffers, name)

	sm.logger.Info("Deleted shared memory buffer",
		zap.String("name", name),
		zap.Int64("size", buffer.Size))

	return nil
}

// ListBuffers returns a list of all buffers
func (sm *SharedMemoryManager) ListBuffers() []*SharedBuffer {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	buffers := make([]*SharedBuffer, 0, len(sm.buffers))
	for _, buffer := range sm.buffers {
		buffers = append(buffers, buffer)
	}

	return buffers
}

// GetMetrics returns current memory metrics
func (sm *SharedMemoryManager) GetMetrics() map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	activeCount := 0
	totalSize := int64(0)
	for _, buffer := range sm.buffers {
		if time.Since(buffer.LastUsed) < 5*time.Minute {
			activeCount++
		}
		totalSize += buffer.Size
	}

	sm.metrics.activeBuffers.Set(float64(activeCount))

	return map[string]interface{}{
		"total_buffers":   len(sm.buffers),
		"active_buffers":  activeCount,
		"total_memory":    totalSize,
		"memory_usage_mb": float64(totalSize) / (1024 * 1024),
	}
}

// HTTP Handlers

func setupRoutes(sm *SharedMemoryManager) *gin.Engine {
	r := gin.Default()

	// Health endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "shared-memory"})
	})

	// Memory management endpoints
	r.POST("/memory/buffer", func(c *gin.Context) {
		var req struct {
			Name string `json:"name"`
			Size int64  `json:"size"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := sm.CreateBuffer(req.Name, req.Size); err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Buffer created successfully"})
	})

	r.GET("/memory/buffer/:name", func(c *gin.Context) {
		name := c.Param("name")
		offset := c.DefaultQuery("offset", "0")
		length := c.DefaultQuery("length", "1024")

		var offsetInt, lengthInt int64
		if _, err := fmt.Sscanf(offset, "%d", &offsetInt); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset"})
			return
		}
		if _, err := fmt.Sscanf(length, "%d", &lengthInt); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid length"})
			return
		}

		data, err := sm.ReadBuffer(name, offsetInt, lengthInt)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"name":   name,
			"offset": offsetInt,
			"length": len(data),
			"data":   data,
		})
	})

	r.POST("/memory/buffer/:name", func(c *gin.Context) {
		name := c.Param("name")
		offset := c.DefaultQuery("offset", "0")

		var offsetInt int64
		if _, err := fmt.Sscanf(offset, "%d", &offsetInt); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset"})
			return
		}

		var req struct {
			Data []byte `json:"data"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := sm.WriteBuffer(name, offsetInt, req.Data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Data written successfully"})
	})

	r.DELETE("/memory/buffer/:name", func(c *gin.Context) {
		name := c.Param("name")

		if err := sm.DeleteBuffer(name); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Buffer deleted successfully"})
	})

	r.GET("/memory/buffers", func(c *gin.Context) {
		buffers := sm.ListBuffers()
		c.JSON(http.StatusOK, gin.H{"buffers": buffers})
	})

	r.GET("/memory/metrics", func(c *gin.Context) {
		metrics := sm.GetMetrics()
		c.JSON(http.StatusOK, metrics)
	})

	// Prometheus metrics endpoint
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	return r
}

func main() {
	sm := NewSharedMemoryManager()
	router := setupRoutes(sm)

	port := "8020"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	sm.logger.Info("Shared memory service starting", zap.String("port", port))

	if err := router.Run(":" + port); err != nil {
		sm.logger.Fatal("Failed to start server", zap.Error(err))
	}
}
