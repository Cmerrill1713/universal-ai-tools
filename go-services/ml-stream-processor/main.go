package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/universal-ai-tools/go-services/shared"
	"go.uber.org/zap"
)

// ML Stream types
type MLStreamType string

const (
	MLStreamTypeInference  MLStreamType = "inference"
	MLStreamTypeTraining   MLStreamType = "training"
	MLStreamTypeEmbedding  MLStreamType = "embedding"
	MLStreamTypeGeneration MLStreamType = "generation"
)

type MLStreamProcessor struct {
	config       *shared.Config
	logger       *zap.Logger
	streams      map[string]*MLStream
	subscribers  map[string][]*StreamSubscriber
	metrics      *MLStreamMetrics
	shutdownChan chan struct{}
	mu           sync.RWMutex
}

type MLStream struct {
	ID             string                 `json:"id"`
	Type           MLStreamType           `json:"type"`
	ModelID        string                 `json:"model_id"`
	Framework      string                 `json:"framework"` // go, rust
	Status         string                 `json:"status"`
	CreatedAt      time.Time              `json:"created_at"`
	ProcessedItems int64                  `json:"processed_items"`
	Buffer         chan *MLStreamData     `json:"-"`
	Context        context.Context        `json:"-"`
	Cancel         context.CancelFunc     `json:"-"`
	Parameters     map[string]interface{} `json:"parameters"`
}

type MLStreamData struct {
	StreamID   string                 `json:"stream_id"`
	Sequence   int64                  `json:"sequence"`
	Data       interface{}            `json:"data"`
	Metadata   map[string]interface{} `json:"metadata"`
	Timestamp  time.Time              `json:"timestamp"`
	IsComplete bool                   `json:"is_complete"`
}

type StreamSubscriber struct {
	ID         string
	StreamID   string
	Connection *websocket.Conn
	Send       chan *MLStreamData
	Done       chan struct{}
}

type MLStreamMetrics struct {
	streamsActive     prometheus.Gauge
	dataProcessed     prometheus.Counter
	processingLatency prometheus.Histogram
	streamDuration    prometheus.Histogram
	errorCount        prometheus.Counter
}

func NewMLStreamMetrics() *MLStreamMetrics {
	return &MLStreamMetrics{
		streamsActive: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "ml_streams_active",
			Help: "Number of active ML streams",
		}),
		dataProcessed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "ml_stream_data_processed_total",
			Help: "Total ML stream data items processed",
		}),
		processingLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "ml_stream_processing_latency_seconds",
			Help:    "ML stream processing latency",
			Buckets: prometheus.DefBuckets,
		}),
		streamDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "ml_stream_duration_seconds",
			Help:    "ML stream total duration",
			Buckets: prometheus.ExponentialBuckets(1, 2, 10),
		}),
		errorCount: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "ml_stream_errors_total",
			Help: "Total ML stream processing errors",
		}),
	}
}

func NewMLStreamProcessor(config *shared.Config, logger *zap.Logger) (*MLStreamProcessor, error) {
	return &MLStreamProcessor{
		config:       config,
		logger:       logger,
		streams:      make(map[string]*MLStream),
		subscribers:  make(map[string][]*StreamSubscriber),
		metrics:      NewMLStreamMetrics(),
		shutdownChan: make(chan struct{}),
	}, nil
}

func (p *MLStreamProcessor) CreateStream(streamType MLStreamType, modelID, framework string, params map[string]interface{}) (*MLStream, error) {
	streamID := fmt.Sprintf("ml-stream-%d", time.Now().UnixNano())
	ctx, cancel := context.WithCancel(context.Background())

	stream := &MLStream{
		ID:         streamID,
		Type:       streamType,
		ModelID:    modelID,
		Framework:  framework,
		Status:     "active",
		CreatedAt:  time.Now(),
		Buffer:     make(chan *MLStreamData, 1000),
		Context:    ctx,
		Cancel:     cancel,
		Parameters: params,
	}

	p.mu.Lock()
	p.streams[streamID] = stream
	p.mu.Unlock()

	p.metrics.streamsActive.Inc()

	// Start processing goroutine
	go p.processStream(stream)

	p.logger.Info("Created ML stream",
		zap.String("id", streamID),
		zap.String("type", string(streamType)),
		zap.String("model", modelID))

	return stream, nil
}

func (p *MLStreamProcessor) processStream(stream *MLStream) {
	defer func() {
		stream.Status = "completed"
		p.metrics.streamsActive.Dec()
		stream.Cancel()
	}()

	startTime := time.Now()

	for {
		select {
		case <-stream.Context.Done():
			p.metrics.streamDuration.Observe(time.Since(startTime).Seconds())
			return

		case data := <-stream.Buffer:
			processingStart := time.Now()

			// Process based on stream type
			switch stream.Type {
			case MLStreamTypeInference:
				p.processInferenceData(stream, data)
			case MLStreamTypeTraining:
				p.processTrainingData(stream, data)
			case MLStreamTypeEmbedding:
				p.processEmbeddingData(stream, data)
			case MLStreamTypeGeneration:
				p.processGenerationData(stream, data)
			}

			// Distribute to subscribers
			p.distributeToSubscribers(stream.ID, data)

			stream.ProcessedItems++
			p.metrics.dataProcessed.Inc()
			p.metrics.processingLatency.Observe(time.Since(processingStart).Seconds())

			if data.IsComplete {
				p.logger.Info("Stream completed",
					zap.String("id", stream.ID),
					zap.Int64("items", stream.ProcessedItems))
				return
			}
		}
	}
}

func (p *MLStreamProcessor) processInferenceData(stream *MLStream, data *MLStreamData) {
	// Route to appropriate ML service based on framework
	var serviceURL string
	if stream.Framework == "go" {
		serviceURL = os.Getenv("ML_GO_SERVICE")
		if serviceURL == "" {
			serviceURL = "http://localhost:8086"
		}
	} else {
		serviceURL = os.Getenv("ML_RUST_SERVICE")
		if serviceURL == "" {
			serviceURL = "http://localhost:8087"
		}
	}

	// Stream inference request
	go p.forwardToMLService(serviceURL, stream, data)
}

func (p *MLStreamProcessor) processTrainingData(stream *MLStream, data *MLStreamData) {
	// Process training batch
	p.logger.Debug("Processing training data",
		zap.String("stream", stream.ID),
		zap.Int64("sequence", data.Sequence))
}

func (p *MLStreamProcessor) processEmbeddingData(stream *MLStream, data *MLStreamData) {
	// Process embedding generation
	p.logger.Debug("Processing embedding data",
		zap.String("stream", stream.ID),
		zap.Int64("sequence", data.Sequence))
}

func (p *MLStreamProcessor) processGenerationData(stream *MLStream, data *MLStreamData) {
	// Process text/image generation
	p.logger.Debug("Processing generation data",
		zap.String("stream", stream.ID),
		zap.Int64("sequence", data.Sequence))
}

func (p *MLStreamProcessor) forwardToMLService(serviceURL string, stream *MLStream, data *MLStreamData) {
	payload, _ := json.Marshal(map[string]interface{}{
		"model_id":   stream.ModelID,
		"input":      data.Data,
		"parameters": stream.Parameters,
		"stream_id":  stream.ID,
		"sequence":   data.Sequence,
	})

	resp, err := http.Post(
		fmt.Sprintf("%s/infer", serviceURL),
		"application/json",
		bytes.NewBuffer(payload),
	)

	if err != nil {
		p.logger.Error("Failed to forward to ML service",
			zap.String("service", serviceURL),
			zap.Error(err))
		p.metrics.errorCount.Inc()
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	// Update stream data with result
	data.Data = result
	data.Metadata["processed_by"] = serviceURL
}

func (p *MLStreamProcessor) distributeToSubscribers(streamID string, data *MLStreamData) {
	p.mu.RLock()
	subscribers := p.subscribers[streamID]
	p.mu.RUnlock()

	for _, sub := range subscribers {
		select {
		case sub.Send <- data:
		case <-sub.Done:
			// Subscriber disconnected
		default:
			// Buffer full, skip
		}
	}
}

func (p *MLStreamProcessor) Run(port int) error {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// API routes
	api := router.Group("/api/v1/ml-stream")
	{
		api.POST("/create", p.handleCreateStream)
		api.POST("/data/:id", p.handleStreamData)
		api.GET("/status/:id", p.handleStreamStatus)
		api.DELETE("/:id", p.handleCloseStream)
		api.GET("/ws/:id", p.handleWebSocket)
	}

	// Health check
	router.GET("/health", p.handleHealth)

	// Metrics
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Start server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		srv.Shutdown(ctx)
		close(p.shutdownChan)
	}()

	p.logger.Info("ML Stream Processor started", zap.Int("port", port))
	return srv.ListenAndServe()
}

func (p *MLStreamProcessor) handleCreateStream(c *gin.Context) {
	var req struct {
		Type       MLStreamType           `json:"type"`
		ModelID    string                 `json:"model_id"`
		Framework  string                 `json:"framework"`
		Parameters map[string]interface{} `json:"parameters"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	stream, err := p.CreateStream(req.Type, req.ModelID, req.Framework, req.Parameters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stream)
}

func (p *MLStreamProcessor) handleStreamData(c *gin.Context) {
	streamID := c.Param("id")

	p.mu.RLock()
	stream, exists := p.streams[streamID]
	p.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "stream not found"})
		return
	}

	var data MLStreamData
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data.StreamID = streamID
	data.Timestamp = time.Now()

	select {
	case stream.Buffer <- &data:
		c.JSON(http.StatusOK, gin.H{"status": "accepted"})
	default:
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "buffer full"})
	}
}

func (p *MLStreamProcessor) handleStreamStatus(c *gin.Context) {
	streamID := c.Param("id")

	p.mu.RLock()
	stream, exists := p.streams[streamID]
	p.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "stream not found"})
		return
	}

	c.JSON(http.StatusOK, stream)
}

func (p *MLStreamProcessor) handleCloseStream(c *gin.Context) {
	streamID := c.Param("id")

	p.mu.Lock()
	stream, exists := p.streams[streamID]
	if exists {
		stream.Cancel()
		delete(p.streams, streamID)
	}
	p.mu.Unlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "stream not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "closed"})
}

func (p *MLStreamProcessor) handleWebSocket(c *gin.Context) {
	streamID := c.Param("id")

	p.mu.RLock()
	_, exists := p.streams[streamID]
	p.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "stream not found"})
		return
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		p.logger.Error("WebSocket upgrade failed", zap.Error(err))
		return
	}
	defer conn.Close()

	subscriber := &StreamSubscriber{
		ID:         fmt.Sprintf("sub-%d", time.Now().UnixNano()),
		StreamID:   streamID,
		Connection: conn,
		Send:       make(chan *MLStreamData, 100),
		Done:       make(chan struct{}),
	}

	p.mu.Lock()
	p.subscribers[streamID] = append(p.subscribers[streamID], subscriber)
	p.mu.Unlock()

	defer func() {
		close(subscriber.Done)
		p.mu.Lock()
		subs := p.subscribers[streamID]
		for i, sub := range subs {
			if sub.ID == subscriber.ID {
				p.subscribers[streamID] = append(subs[:i], subs[i+1:]...)
				break
			}
		}
		p.mu.Unlock()
	}()

	// Reader goroutine
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	// Writer goroutine
	for {
		select {
		case data := <-subscriber.Send:
			if err := conn.WriteJSON(data); err != nil {
				return
			}
		case <-subscriber.Done:
			return
		}
	}
}

func (p *MLStreamProcessor) handleHealth(c *gin.Context) {
	p.mu.RLock()
	activeStreams := len(p.streams)
	p.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"status":         "healthy",
		"active_streams": activeStreams,
		"timestamp":      time.Now(),
	})
}

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	config := &shared.Config{}

	processor, err := NewMLStreamProcessor(config, logger)
	if err != nil {
		logger.Fatal("Failed to create ML stream processor", zap.Error(err))
	}

	// Register metrics
	prometheus.MustRegister(
		processor.metrics.streamsActive,
		processor.metrics.dataProcessed,
		processor.metrics.processingLatency,
		processor.metrics.streamDuration,
		processor.metrics.errorCount,
	)

	port := 8088
	if p := os.Getenv("PORT"); p != "" {
		fmt.Sscanf(p, "%d", &port)
	}

	if err := processor.Run(port); err != nil {
		logger.Fatal("Server failed", zap.Error(err))
	}
}
