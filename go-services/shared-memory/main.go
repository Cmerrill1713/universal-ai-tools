package main

/*
#cgo LDFLAGS: -L../../rust-services/ffi-bridge/target/release -lrust_go_bridge
#include "../../rust-services/ffi-bridge/include/rust_go_bridge.h"
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

// SharedMemoryManager manages high-performance IPC with Rust services
type SharedMemoryManager struct {
	logger       *zap.Logger
	buffers      map[string]*SharedBuffer
	metrics      *IPCMetrics
	mu           sync.RWMutex
	initialized  atomic.Bool
}

// SharedBuffer represents a shared memory region
type SharedBuffer struct {
	Name     string
	Ptr      unsafe.Pointer
	Size     int
	LastUsed time.Time
	RefCount int32
}

// IPCMetrics tracks IPC performance
type IPCMetrics struct {
	transfersTotal    prometheus.Counter
	bytesTransferred  prometheus.Counter
	transferDuration  prometheus.Histogram
	bufferUtilization prometheus.Gauge
	errorCount        prometheus.Counter
}

// IPCMessage for structured communication
type IPCMessage struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Operation string                 `json:"operation"`
	Data      []byte                 `json:"data,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

func NewIPCMetrics() *IPCMetrics {
	return &IPCMetrics{
		transfersTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "ipc_transfers_total",
			Help: "Total number of IPC transfers",
		}),
		bytesTransferred: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "ipc_bytes_transferred_total",
			Help: "Total bytes transferred via IPC",
		}),
		transferDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "ipc_transfer_duration_seconds",
			Help:    "IPC transfer duration",
			Buckets: prometheus.ExponentialBuckets(0.0001, 2, 10),
		}),
		bufferUtilization: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "ipc_buffer_utilization_ratio",
			Help: "Shared buffer utilization ratio",
		}),
		errorCount: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "ipc_errors_total",
			Help: "Total IPC errors",
		}),
	}
}

func NewSharedMemoryManager(logger *zap.Logger) (*SharedMemoryManager, error) {
	mgr := &SharedMemoryManager{
		logger:  logger,
		buffers: make(map[string]*SharedBuffer),
		metrics: NewIPCMetrics(),
	}

	// Initialize Rust FFI bridge
	result := C.rust_bridge_init()
	if result != 0 {
		return nil, fmt.Errorf("failed to initialize Rust bridge: %d", result)
	}

	mgr.initialized.Store(true)
	logger.Info("Shared memory manager initialized")

	// Register metrics
	prometheus.MustRegister(
		mgr.metrics.transfersTotal,
		mgr.metrics.bytesTransferred,
		mgr.metrics.transferDuration,
		mgr.metrics.bufferUtilization,
		mgr.metrics.errorCount,
	)

	return mgr, nil
}

// CreateBuffer creates a new shared memory buffer
func (m *SharedMemoryManager) CreateBuffer(name string, size int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.buffers[name]; exists {
		return fmt.Errorf("buffer %s already exists", name)
	}

	cName := C.CString(name)
	defer C.free(unsafe.Pointer(cName))

	ptr := C.rust_bridge_create_shared_buffer(cName, C.size_t(size))
	if ptr == nil {
		return fmt.Errorf("failed to create shared buffer")
	}

	m.buffers[name] = &SharedBuffer{
		Name:     name,
		Ptr:      unsafe.Pointer(ptr),
		Size:     size,
		LastUsed: time.Now(),
		RefCount: 0,
	}

	m.logger.Info("Created shared buffer", 
		zap.String("name", name),
		zap.Int("size", size))

	return nil
}

// WriteToBuffer writes data to a shared buffer
func (m *SharedMemoryManager) WriteToBuffer(name string, data []byte) error {
	m.mu.RLock()
	buffer, exists := m.buffers[name]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("buffer %s not found", name)
	}

	if len(data) > buffer.Size {
		return fmt.Errorf("data size %d exceeds buffer size %d", len(data), buffer.Size)
	}

	start := time.Now()
	
	cName := C.CString(name)
	defer C.free(unsafe.Pointer(cName))

	result := C.rust_bridge_write_shared_buffer(
		cName,
		(*C.uchar)(unsafe.Pointer(&data[0])),
		C.size_t(len(data)),
	)

	if result != 0 {
		m.metrics.errorCount.Inc()
		return fmt.Errorf("failed to write to buffer: %d", result)
	}

	duration := time.Since(start)
	m.metrics.transfersTotal.Inc()
	m.metrics.bytesTransferred.Add(float64(len(data)))
	m.metrics.transferDuration.Observe(duration.Seconds())

	atomic.AddInt32(&buffer.RefCount, 1)
	buffer.LastUsed = time.Now()

	return nil
}

// ReadFromBuffer reads data from a shared buffer
func (m *SharedMemoryManager) ReadFromBuffer(name string, maxSize int) ([]byte, error) {
	m.mu.RLock()
	buffer, exists := m.buffers[name]
	m.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("buffer %s not found", name)
	}

	output := make([]byte, maxSize)
	
	cName := C.CString(name)
	defer C.free(unsafe.Pointer(cName))

	bytesRead := C.rust_bridge_read_shared_buffer(
		cName,
		(*C.uchar)(unsafe.Pointer(&output[0])),
		C.size_t(maxSize),
	)

	if bytesRead < 0 {
		m.metrics.errorCount.Inc()
		return nil, fmt.Errorf("failed to read from buffer: %d", bytesRead)
	}

	buffer.LastUsed = time.Now()
	return output[:bytesRead], nil
}

// CallRustFunction calls a Rust function via FFI
func (m *SharedMemoryManager) CallRustFunction(operation string, data []byte) ([]byte, error) {
	if !m.initialized.Load() {
		return nil, fmt.Errorf("bridge not initialized")
	}

	start := time.Now()
	
	cOp := C.CString(operation)
	defer C.free(unsafe.Pointer(cOp))

	var dataPtr *C.uchar
	if len(data) > 0 {
		dataPtr = (*C.uchar)(unsafe.Pointer(&data[0]))
	}

	result := C.rust_bridge_call(cOp, dataPtr, C.size_t(len(data)))
	defer C.rust_bridge_free_result(result)

	if result.success == 0 {
		errorMsg := C.GoString(result.error)
		m.metrics.errorCount.Inc()
		return nil, fmt.Errorf("rust call failed: %s", errorMsg)
	}

	output := C.GoBytes(unsafe.Pointer(result.data), C.int(result.len))
	
	duration := time.Since(start)
	m.metrics.transfersTotal.Inc()
	m.metrics.bytesTransferred.Add(float64(len(output)))
	m.metrics.transferDuration.Observe(duration.Seconds())

	return output, nil
}

// MLInference performs ML inference via Rust
func (m *SharedMemoryManager) MLInference(modelID string, input []byte, params string) ([]byte, error) {
	cModel := C.CString(modelID)
	defer C.free(unsafe.Pointer(cModel))
	
	cParams := C.CString(params)
	defer C.free(unsafe.Pointer(cParams))

	var inputPtr *C.uchar
	if len(input) > 0 {
		inputPtr = (*C.uchar)(unsafe.Pointer(&input[0]))
	}

	result := C.rust_bridge_ml_inference(cModel, inputPtr, C.size_t(len(input)), cParams)
	defer C.rust_bridge_free_result(result)

	if result.success == 0 {
		errorMsg := C.GoString(result.error)
		return nil, fmt.Errorf("ml inference failed: %s", errorMsg)
	}

	return C.GoBytes(unsafe.Pointer(result.data), C.int(result.len)), nil
}

// VisionProcess processes vision tasks via Rust
func (m *SharedMemoryManager) VisionProcess(taskType string, imageData []byte) ([]byte, error) {
	cTask := C.CString(taskType)
	defer C.free(unsafe.Pointer(cTask))

	var imagePtr *C.uchar
	if len(imageData) > 0 {
		imagePtr = (*C.uchar)(unsafe.Pointer(&imageData[0]))
	}

	result := C.rust_bridge_vision_process(cTask, imagePtr, C.size_t(len(imageData)))
	defer C.rust_bridge_free_result(result)

	if result.success == 0 {
		errorMsg := C.GoString(result.error)
		return nil, fmt.Errorf("vision processing failed: %s", errorMsg)
	}

	return C.GoBytes(unsafe.Pointer(result.data), C.int(result.len)), nil
}

// AsyncCall starts an async operation in Rust
func (m *SharedMemoryManager) AsyncCall(operation string, data []byte) (*AsyncOperation, error) {
	cOp := C.CString(operation)
	defer C.free(unsafe.Pointer(cOp))

	var dataPtr *C.uchar
	if len(data) > 0 {
		dataPtr = (*C.uchar)(unsafe.Pointer(&data[0]))
	}

	handle := C.rust_bridge_async_start(cOp, dataPtr, C.size_t(len(data)))
	
	return &AsyncOperation{
		handle:  handle,
		manager: m,
	}, nil
}

// AsyncOperation represents an ongoing async operation
type AsyncOperation struct {
	handle  C.AsyncHandle
	manager *SharedMemoryManager
}

// IsReady checks if the async operation is complete
func (op *AsyncOperation) IsReady() bool {
	return C.rust_bridge_async_check(op.handle) == 1
}

// GetResult retrieves the result of an async operation
func (op *AsyncOperation) GetResult() ([]byte, error) {
	result := C.rust_bridge_async_get(op.handle)
	defer C.rust_bridge_free_result(result)

	if result.success == 0 {
		errorMsg := C.GoString(result.error)
		return nil, fmt.Errorf("async operation failed: %s", errorMsg)
	}

	return C.GoBytes(unsafe.Pointer(result.data), C.int(result.len)), nil
}

// HTTP API handlers

func (m *SharedMemoryManager) handleCreateBuffer(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
		Size int    `json:"size" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := m.CreateBuffer(req.Name, req.Size); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "created", "name": req.Name, "size": req.Size})
}

func (m *SharedMemoryManager) handleWriteBuffer(c *gin.Context) {
	name := c.Param("name")
	data, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := m.WriteToBuffer(name, data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "written", "bytes": len(data)})
}

func (m *SharedMemoryManager) handleReadBuffer(c *gin.Context) {
	name := c.Param("name")
	maxSize := 1024 * 1024 // 1MB default
	
	data, err := m.ReadFromBuffer(name, maxSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/octet-stream", data)
}

func (m *SharedMemoryManager) handleCallRust(c *gin.Context) {
	var req struct {
		Operation string          `json:"operation" binding:"required"`
		Data      json.RawMessage `json:"data"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := m.CallRustFunction(req.Operation, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/json", result)
}

func (m *SharedMemoryManager) handleMLInference(c *gin.Context) {
	var req struct {
		ModelID    string          `json:"model_id" binding:"required"`
		Input      json.RawMessage `json:"input" binding:"required"`
		Parameters string          `json:"parameters"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := m.MLInference(req.ModelID, req.Input, req.Parameters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/json", result)
}

func (m *SharedMemoryManager) handleHealth(c *gin.Context) {
	m.mu.RLock()
	bufferCount := len(m.buffers)
	m.mu.RUnlock()

	// Get metrics from Rust
	result := C.rust_bridge_get_metrics()
	defer C.rust_bridge_free_result(result)

	var rustMetrics map[string]interface{}
	if result.success == 1 {
		metricsData := C.GoBytes(unsafe.Pointer(result.data), C.int(result.len))
		json.Unmarshal(metricsData, &rustMetrics)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "healthy",
		"initialized":  m.initialized.Load(),
		"buffer_count": bufferCount,
		"rust_metrics": rustMetrics,
		"timestamp":    time.Now(),
	})
}

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	mgr, err := NewSharedMemoryManager(logger)
	if err != nil {
		logger.Fatal("Failed to create shared memory manager", zap.Error(err))
	}

	// Create some default buffers
	mgr.CreateBuffer("ml_input", 10*1024*1024)   // 10MB for ML input
	mgr.CreateBuffer("ml_output", 10*1024*1024)  // 10MB for ML output
	mgr.CreateBuffer("vision", 50*1024*1024)     // 50MB for vision data
	mgr.CreateBuffer("streaming", 100*1024*1024) // 100MB for streaming

	// Setup HTTP server
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// API routes
	api := router.Group("/api/v1/ipc")
	{
		api.POST("/buffer", mgr.handleCreateBuffer)
		api.PUT("/buffer/:name", mgr.handleWriteBuffer)
		api.GET("/buffer/:name", mgr.handleReadBuffer)
		api.POST("/call", mgr.handleCallRust)
		api.POST("/ml/inference", mgr.handleMLInference)
		api.GET("/health", mgr.handleHealth)
	}

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	port := 8089
	if p := os.Getenv("PORT"); p != "" {
		fmt.Sscanf(p, "%d", &port)
	}

	logger.Info("Shared memory IPC server starting", zap.Int("port", port))
	if err := router.Run(fmt.Sprintf(":%d", port)); err != nil {
		logger.Fatal("Server failed", zap.Error(err))
	}
}