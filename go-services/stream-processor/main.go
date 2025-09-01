package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/universal-ai-tools/go-services/shared"
	"go.uber.org/zap"
)

type StreamProcessor struct {
	config       *shared.Config
	logger       *zap.Logger
	natsConn     *nats.Conn
	streams      sync.Map // streamID -> *Stream
	processors   map[string]ProcessorFunc
	metrics      *StreamMetrics
	wsUpgrader   websocket.Upgrader
	shutdownChan chan struct{}
}

type Stream struct {
	ID           string
	Config       *shared.StreamConfig
	InputChan    chan *shared.StreamChunk
	OutputChan   chan *shared.StreamChunk
	Subscribers  sync.Map // connectionID -> chan *shared.StreamChunk
	Status       string
	StartTime    time.Time
	ChunkCount   int64
	BytesProcessed int64
	LastActivity time.Time
	mu           sync.RWMutex
}

type ProcessorFunc func(ctx context.Context, chunk *shared.StreamChunk) (*shared.StreamChunk, error)

type StreamMetrics struct {
	activeStreams     prometheus.Gauge
	chunksProcessed   *prometheus.CounterVec
	bytesProcessed    *prometheus.CounterVec
	processingLatency *prometheus.HistogramVec
	streamDuration    *prometheus.HistogramVec
	errors            *prometheus.CounterVec
}

func NewStreamMetrics() *StreamMetrics {
	return &StreamMetrics{
		activeStreams: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "stream_processor_active_streams",
				Help: "Number of active streams",
			},
		),
		chunksProcessed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "stream_processor_chunks_total",
				Help: "Total number of chunks processed",
			},
			[]string{"stream_type", "source"},
		),
		bytesProcessed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "stream_processor_bytes_total",
				Help: "Total bytes processed",
			},
			[]string{"stream_type", "source"},
		),
		processingLatency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "stream_processor_latency_seconds",
				Help:    "Processing latency in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"stream_type", "processor"},
		),
		streamDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "stream_processor_duration_seconds",
				Help:    "Total stream duration in seconds",
				Buckets: []float64{1, 5, 10, 30, 60, 120, 300, 600},
			},
			[]string{"stream_type"},
		),
		errors: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "stream_processor_errors_total",
				Help: "Total number of processing errors",
			},
			[]string{"stream_type", "error_type"},
		),
	}
}

func NewStreamProcessor(config *shared.Config, logger *zap.Logger) (*StreamProcessor, error) {
	nc, err := nats.Connect(config.NATS.URL,
		nats.MaxReconnects(config.NATS.MaxReconnects),
		nats.ReconnectWait(time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	sp := &StreamProcessor{
		config:   config,
		logger:   logger,
		natsConn: nc,
		metrics:  NewStreamMetrics(),
		wsUpgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Configure properly in production
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		processors:   make(map[string]ProcessorFunc),
		shutdownChan: make(chan struct{}),
	}

	// Register processors
	sp.registerProcessors()

	// Register metrics
	prometheus.MustRegister(
		sp.metrics.activeStreams,
		sp.metrics.chunksProcessed,
		sp.metrics.bytesProcessed,
		sp.metrics.processingLatency,
		sp.metrics.streamDuration,
		sp.metrics.errors,
	)

	return sp, nil
}

func (sp *StreamProcessor) registerProcessors() {
	// Vision stream processor
	sp.processors["vision"] = sp.processVisionStream
	
	// Audio/Voice stream processor
	sp.processors["audio"] = sp.processAudioStream
	
	// Parameter update stream processor
	sp.processors["parameters"] = sp.processParameterStream
	
	// Generic data stream processor
	sp.processors["data"] = sp.processDataStream
}

func (sp *StreamProcessor) Start() error {
	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Stream management
	router.POST("/stream/create", sp.createStreamHandler)
	router.DELETE("/stream/:id", sp.deleteStreamHandler)
	router.GET("/stream/:id/status", sp.streamStatusHandler)
	
	// Stream data endpoints
	router.POST("/stream/:id/chunk", sp.sendChunkHandler)
	router.GET("/stream/:id/subscribe", sp.subscribeHandler)
	
	// Batch processing
	router.POST("/stream/batch", sp.batchProcessHandler)
	
	// Health and metrics
	router.GET("/health", sp.healthCheckHandler)
	router.GET("/streams", sp.listStreamsHandler)
	
	if sp.config.Metrics.Enabled {
		router.GET(sp.config.Metrics.Path, gin.WrapH(promhttp.Handler()))
	}

	// Start background tasks
	go sp.startStreamCleaner()
	go sp.startNATSSubscriptions()

	// Start HTTP server
	srv := &http.Server{
		Addr:    ":" + sp.config.HTTP.Port,
		Handler: router,
	}

	go func() {
		sp.logger.Info("Starting stream processor", zap.String("port", sp.config.HTTP.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			sp.logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	sp.logger.Info("Shutting down stream processor")
	close(sp.shutdownChan)

	// Close all active streams
	sp.streams.Range(func(key, value interface{}) bool {
		if stream, ok := value.(*Stream); ok {
			sp.closeStream(stream)
		}
		return true
	})

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	sp.natsConn.Close()
	return srv.Shutdown(ctx)
}

func (sp *StreamProcessor) createStreamHandler(c *gin.Context) {
	var config shared.StreamConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if config.StreamID == "" {
		config.StreamID = fmt.Sprintf("stream_%d_%d", time.Now().Unix(), time.Now().Nanosecond())
	}

	if config.BufferSize == 0 {
		config.BufferSize = 100
	}

	stream := &Stream{
		ID:         config.StreamID,
		Config:     &config,
		InputChan:  make(chan *shared.StreamChunk, config.BufferSize),
		OutputChan: make(chan *shared.StreamChunk, config.BufferSize),
		Status:     "active",
		StartTime:  time.Now(),
	}

	// Store stream
	sp.streams.Store(config.StreamID, stream)
	sp.metrics.activeStreams.Inc()

	// Start processing goroutine
	go sp.processStream(stream)

	sp.logger.Info("Created stream",
		zap.String("stream_id", config.StreamID),
		zap.String("type", config.Type))

	c.JSON(http.StatusOK, gin.H{
		"stream_id": config.StreamID,
		"status":    "created",
	})
}

func (sp *StreamProcessor) deleteStreamHandler(c *gin.Context) {
	streamID := c.Param("id")

	if value, exists := sp.streams.Load(streamID); exists {
		stream := value.(*Stream)
		sp.closeStream(stream)
		sp.streams.Delete(streamID)
		sp.metrics.activeStreams.Dec()

		duration := time.Since(stream.StartTime)
		sp.metrics.streamDuration.WithLabelValues(stream.Config.Type).Observe(duration.Seconds())

		c.JSON(http.StatusOK, gin.H{
			"status":    "deleted",
			"stream_id": streamID,
			"duration":  duration.String(),
		})
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "stream not found"})
	}
}

func (sp *StreamProcessor) sendChunkHandler(c *gin.Context) {
	streamID := c.Param("id")

	value, exists := sp.streams.Load(streamID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "stream not found"})
		return
	}

	stream := value.(*Stream)
	
	// Read chunk data
	data, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	chunk := &shared.StreamChunk{
		StreamID:  streamID,
		Sequence:  atomic.AddInt64(&stream.ChunkCount, 1),
		Data:      data,
		Timestamp: time.Now(),
		IsLast:    c.GetHeader("X-Stream-Last") == "true",
	}

	// Send to input channel
	select {
	case stream.InputChan <- chunk:
		atomic.AddInt64(&stream.BytesProcessed, int64(len(data)))
		stream.LastActivity = time.Now()
		
		sp.metrics.chunksProcessed.WithLabelValues(
			stream.Config.Type,
			string(stream.Config.Source),
		).Inc()
		
		sp.metrics.bytesProcessed.WithLabelValues(
			stream.Config.Type,
			string(stream.Config.Source),
		).Add(float64(len(data)))

		c.JSON(http.StatusOK, gin.H{
			"status":   "accepted",
			"sequence": chunk.Sequence,
		})
		
	case <-time.After(5 * time.Second):
		c.JSON(http.StatusRequestTimeout, gin.H{"error": "stream buffer full"})
	}
}

func (sp *StreamProcessor) subscribeHandler(c *gin.Context) {
	streamID := c.Param("id")

	value, exists := sp.streams.Load(streamID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "stream not found"})
		return
	}

	stream := value.(*Stream)

	// Upgrade to WebSocket
	conn, err := sp.wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		sp.logger.Error("Failed to upgrade WebSocket", zap.Error(err))
		return
	}
	defer conn.Close()

	// Create subscriber channel
	subID := fmt.Sprintf("sub_%d", time.Now().UnixNano())
	subChan := make(chan *shared.StreamChunk, 10)
	stream.Subscribers.Store(subID, subChan)
	defer stream.Subscribers.Delete(subID)

	sp.logger.Info("Stream subscriber connected",
		zap.String("stream_id", streamID),
		zap.String("subscriber_id", subID))

	// Send chunks to subscriber
	for {
		select {
		case chunk := <-subChan:
			if err := conn.WriteJSON(chunk); err != nil {
				sp.logger.Error("Failed to send chunk to subscriber", zap.Error(err))
				return
			}
			
			if chunk.IsLast {
				return
			}
			
		case <-sp.shutdownChan:
			return
			
		case <-time.After(30 * time.Second):
			// Send ping to keep connection alive
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (sp *StreamProcessor) processStream(stream *Stream) {
	defer func() {
		if r := recover(); r != nil {
			sp.logger.Error("Stream processor panic",
				zap.String("stream_id", stream.ID),
				zap.Any("error", r))
		}
	}()

	// Get processor for stream type
	processor, exists := sp.processors[stream.Config.Type]
	if !exists {
		processor = sp.processors["data"] // Default processor
	}

	ctx := context.Background()

	for chunk := range stream.InputChan {
		start := time.Now()

		// Process chunk
		processedChunk, err := processor(ctx, chunk)
		if err != nil {
			sp.logger.Error("Failed to process chunk",
				zap.String("stream_id", stream.ID),
				zap.Int64("sequence", chunk.Sequence),
				zap.Error(err))
			
			sp.metrics.errors.WithLabelValues(stream.Config.Type, "processing").Inc()
			continue
		}

		// Record metrics
		sp.metrics.processingLatency.WithLabelValues(
			stream.Config.Type,
			stream.Config.Type,
		).Observe(time.Since(start).Seconds())

		// Send to output channel
		select {
		case stream.OutputChan <- processedChunk:
			// Broadcast to subscribers
			sp.broadcastToSubscribers(stream, processedChunk)
			
		default:
			sp.logger.Warn("Output channel full",
				zap.String("stream_id", stream.ID))
		}

		// Check if this was the last chunk
		if chunk.IsLast {
			sp.closeStream(stream)
			break
		}
	}
}

func (sp *StreamProcessor) broadcastToSubscribers(stream *Stream, chunk *shared.StreamChunk) {
	stream.Subscribers.Range(func(key, value interface{}) bool {
		if subChan, ok := value.(chan *shared.StreamChunk); ok {
			select {
			case subChan <- chunk:
			default:
				sp.logger.Warn("Subscriber channel full",
					zap.String("stream_id", stream.ID),
					zap.String("subscriber_id", key.(string)))
			}
		}
		return true
	})
}

func (sp *StreamProcessor) closeStream(stream *Stream) {
	stream.mu.Lock()
	defer stream.mu.Unlock()

	if stream.Status == "closed" {
		return
	}

	stream.Status = "closed"
	close(stream.InputChan)
	close(stream.OutputChan)

	// Close all subscriber channels
	stream.Subscribers.Range(func(key, value interface{}) bool {
		if subChan, ok := value.(chan *shared.StreamChunk); ok {
			close(subChan)
		}
		return true
	})
}

// Stream processors
func (sp *StreamProcessor) processVisionStream(ctx context.Context, chunk *shared.StreamChunk) (*shared.StreamChunk, error) {
	// Vision-specific processing
	// Could include format conversion, enhancement, etc.
	
	// For now, just pass through with metadata
	processedChunk := &shared.StreamChunk{
		StreamID:  chunk.StreamID,
		Sequence:  chunk.Sequence,
		Data:      chunk.Data,
		Timestamp: time.Now(),
		IsLast:    chunk.IsLast,
		Metadata: map[string]any{
			"processor": "vision",
			"processed": true,
		},
	}

	return processedChunk, nil
}

func (sp *StreamProcessor) processAudioStream(ctx context.Context, chunk *shared.StreamChunk) (*shared.StreamChunk, error) {
	// Audio-specific processing
	// Could include transcoding, noise reduction, etc.
	
	processedChunk := &shared.StreamChunk{
		StreamID:  chunk.StreamID,
		Sequence:  chunk.Sequence,
		Data:      chunk.Data,
		Timestamp: time.Now(),
		IsLast:    chunk.IsLast,
		Metadata: map[string]any{
			"processor": "audio",
			"processed": true,
		},
	}

	return processedChunk, nil
}

func (sp *StreamProcessor) processParameterStream(ctx context.Context, chunk *shared.StreamChunk) (*shared.StreamChunk, error) {
	// Parameter update processing
	// Parse and validate parameter updates
	
	var params map[string]any
	if err := json.Unmarshal(chunk.Data, &params); err != nil {
		return nil, fmt.Errorf("invalid parameter data: %w", err)
	}

	// Validate parameters
	// Apply any transformations
	
	processedData, _ := json.Marshal(params)
	
	processedChunk := &shared.StreamChunk{
		StreamID:  chunk.StreamID,
		Sequence:  chunk.Sequence,
		Data:      processedData,
		Timestamp: time.Now(),
		IsLast:    chunk.IsLast,
		Metadata: map[string]any{
			"processor": "parameters",
			"validated": true,
		},
	}

	return processedChunk, nil
}

func (sp *StreamProcessor) processDataStream(ctx context.Context, chunk *shared.StreamChunk) (*shared.StreamChunk, error) {
	// Generic data stream processing
	// Just pass through with minimal processing
	
	processedChunk := &shared.StreamChunk{
		StreamID:  chunk.StreamID,
		Sequence:  chunk.Sequence,
		Data:      chunk.Data,
		Timestamp: time.Now(),
		IsLast:    chunk.IsLast,
		Metadata: map[string]any{
			"processor": "generic",
		},
	}

	return processedChunk, nil
}

func (sp *StreamProcessor) batchProcessHandler(c *gin.Context) {
	var req struct {
		StreamType string                 `json:"stream_type"`
		Chunks     []json.RawMessage      `json:"chunks"`
		Options    map[string]any         `json:"options"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	processor, exists := sp.processors[req.StreamType]
	if !exists {
		processor = sp.processors["data"]
	}

	ctx := context.Background()
	results := make([]json.RawMessage, 0, len(req.Chunks))

	for i, chunkData := range req.Chunks {
		chunk := &shared.StreamChunk{
			StreamID:  fmt.Sprintf("batch_%d", time.Now().Unix()),
			Sequence:  int64(i),
			Data:      chunkData,
			Timestamp: time.Now(),
		}

		processedChunk, err := processor(ctx, chunk)
		if err != nil {
			sp.logger.Error("Batch processing error", zap.Error(err))
			continue
		}

		results = append(results, processedChunk.Data)
	}

	c.JSON(http.StatusOK, gin.H{
		"processed": len(results),
		"results":   results,
	})
}

func (sp *StreamProcessor) streamStatusHandler(c *gin.Context) {
	streamID := c.Param("id")

	value, exists := sp.streams.Load(streamID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "stream not found"})
		return
	}

	stream := value.(*Stream)
	
	subscriberCount := 0
	stream.Subscribers.Range(func(_, _ interface{}) bool {
		subscriberCount++
		return true
	})

	c.JSON(http.StatusOK, gin.H{
		"stream_id":        stream.ID,
		"status":          stream.Status,
		"type":            stream.Config.Type,
		"chunks_processed": atomic.LoadInt64(&stream.ChunkCount),
		"bytes_processed":  atomic.LoadInt64(&stream.BytesProcessed),
		"subscribers":      subscriberCount,
		"duration":        time.Since(stream.StartTime).String(),
		"last_activity":   stream.LastActivity.Format(time.RFC3339),
	})
}

func (sp *StreamProcessor) listStreamsHandler(c *gin.Context) {
	streams := make([]map[string]any, 0)

	sp.streams.Range(func(key, value interface{}) bool {
		if stream, ok := value.(*Stream); ok {
			streams = append(streams, map[string]any{
				"id":              stream.ID,
				"type":            stream.Config.Type,
				"status":          stream.Status,
				"chunks":          atomic.LoadInt64(&stream.ChunkCount),
				"bytes":           atomic.LoadInt64(&stream.BytesProcessed),
				"duration":        time.Since(stream.StartTime).Seconds(),
			})
		}
		return true
	})

	c.JSON(http.StatusOK, streams)
}

func (sp *StreamProcessor) healthCheckHandler(c *gin.Context) {
	activeStreams := 0
	sp.streams.Range(func(_, _ interface{}) bool {
		activeStreams++
		return true
	})

	c.JSON(http.StatusOK, gin.H{
		"status":         "healthy",
		"service":        "stream-processor",
		"active_streams": activeStreams,
		"nats_connected": sp.natsConn.Status() == nats.CONNECTED,
	})
}

func (sp *StreamProcessor) startStreamCleaner() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			sp.cleanInactiveStreams()
		case <-sp.shutdownChan:
			return
		}
	}
}

func (sp *StreamProcessor) cleanInactiveStreams() {
	threshold := 5 * time.Minute
	now := time.Now()

	sp.streams.Range(func(key, value interface{}) bool {
		if stream, ok := value.(*Stream); ok {
			if stream.Status == "active" && now.Sub(stream.LastActivity) > threshold {
				sp.logger.Info("Cleaning inactive stream",
					zap.String("stream_id", stream.ID))
				
				sp.closeStream(stream)
				sp.streams.Delete(key)
				sp.metrics.activeStreams.Dec()
			}
		}
		return true
	})
}

func (sp *StreamProcessor) startNATSSubscriptions() {
	// Subscribe to stream events
	sp.natsConn.Subscribe("stream.create", func(msg *nats.Msg) {
		var config shared.StreamConfig
		if err := json.Unmarshal(msg.Data, &config); err == nil {
			// Create stream via NATS
			// Implementation would be similar to createStreamHandler
		}
	})

	sp.natsConn.Subscribe("stream.chunk", func(msg *nats.Msg) {
		var chunk shared.StreamChunk
		if err := json.Unmarshal(msg.Data, &chunk); err == nil {
			// Process chunk via NATS
			// Implementation would route to appropriate stream
		}
	})
}

func main() {
	// Load configuration
	config, err := shared.LoadConfig("config.yaml")
	if err != nil {
		config = &shared.Config{
			Service: shared.ServiceConfig{
				Name:     "stream-processor",
				LogLevel: "info",
			},
			HTTP: shared.HTTPConfig{
				Port: "8084",
			},
			NATS: shared.NATSConfig{
				URL: "nats://localhost:4222",
			},
		}
	}

	// Setup logger
	logger, err := shared.SetupLogger(config.Service.LogLevel)
	if err != nil {
		panic(fmt.Sprintf("Failed to setup logger: %v", err))
	}

	// Create and start stream processor
	sp, err := NewStreamProcessor(config, logger)
	if err != nil {
		logger.Fatal("Failed to create stream processor", zap.Error(err))
	}

	if err := sp.Start(); err != nil {
		logger.Fatal("Failed to start stream processor", zap.Error(err))
	}
}