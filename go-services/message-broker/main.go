package main

import (
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
	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/universal-ai-tools/go-services/shared"
	"go.uber.org/zap"
)

type MessageBroker struct {
	config       *shared.Config
	logger       *zap.Logger
	natsConn     *nats.Conn
	wsUpgrader   websocket.Upgrader
	connections  sync.Map // ServiceType -> *websocket.Conn
	subscribers  sync.Map // topic -> []chan shared.Message
	metrics      *BrokerMetrics
	resilience   *shared.ResilienceManager
	shutdownChan chan struct{}
}

type BrokerMetrics struct {
	messagesReceived  *prometheus.CounterVec
	messagesForwarded *prometheus.CounterVec
	activeConnections prometheus.Gauge
	processingLatency *prometheus.HistogramVec
}

func NewBrokerMetrics() *BrokerMetrics {
	return &BrokerMetrics{
		messagesReceived: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "message_broker_messages_received_total",
				Help: "Total number of messages received",
			},
			[]string{"source", "type"},
		),
		messagesForwarded: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "message_broker_messages_forwarded_total",
				Help: "Total number of messages forwarded",
			},
			[]string{"destination", "type"},
		),
		activeConnections: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "message_broker_active_connections",
				Help: "Number of active WebSocket connections",
			},
		),
		processingLatency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "message_broker_processing_latency_seconds",
				Help:    "Message processing latency in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"source", "destination"},
		),
	}
}

func NewMessageBroker(config *shared.Config, logger *zap.Logger) (*MessageBroker, error) {
	nc, err := nats.Connect(config.NATS.URL,
		nats.MaxReconnects(config.NATS.MaxReconnects),
		nats.ReconnectWait(time.Second),
		nats.DisconnectErrHandler(func(nc *nats.Conn, err error) {
			logger.Error("NATS disconnected", zap.Error(err))
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			logger.Info("NATS reconnected")
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	// Setup resilience patterns
	resilienceConfig := shared.DefaultResilienceConfig()
	resilienceConfig.Timeout = 5 * time.Second
	resilienceConfig.BulkheadSize = 50
	resilience := shared.NewResilienceManager(resilienceConfig)

	broker := &MessageBroker{
		config: config,
		logger: logger,
		natsConn: nc,
		wsUpgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// In production, implement proper origin checking
				return true
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		metrics:      NewBrokerMetrics(),
		resilience:   resilience,
		shutdownChan: make(chan struct{}),
	}

	// Register metrics
	prometheus.MustRegister(
		broker.metrics.messagesReceived,
		broker.metrics.messagesForwarded,
		broker.metrics.activeConnections,
		broker.metrics.processingLatency,
	)

	return broker, nil
}

func (mb *MessageBroker) Start() error {
	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Health check endpoint
	router.GET("/health", mb.healthCheckHandler)

	// WebSocket endpoint for service connections
	router.GET("/ws/:service", mb.websocketHandler)

	// Message publishing endpoint
	router.POST("/publish", mb.publishHandler)

	// Metrics endpoint
	if mb.config.Metrics.Enabled {
		router.GET(mb.config.Metrics.Path, gin.WrapH(promhttp.Handler()))
	}

	// Resilience metrics endpoint
	router.GET("/resilience-metrics", mb.resilienceMetricsHandler)

	// Start NATS subscriptions
	mb.setupNATSSubscriptions()

	// Start HTTP server
	srv := &http.Server{
		Addr:    ":" + mb.config.HTTP.Port,
		Handler: router,
	}

	// Start server in goroutine
	go func() {
		mb.logger.Info("Starting message broker", zap.String("port", mb.config.HTTP.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			mb.logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	mb.logger.Info("Shutting down message broker")
	close(mb.shutdownChan)

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		mb.logger.Error("Server shutdown error", zap.Error(err))
	}

	mb.natsConn.Close()
	return nil
}

func (mb *MessageBroker) setupNATSSubscriptions() {
	// Subscribe to all service topics
	services := []shared.ServiceType{
		shared.ServiceTypeRustVision,
		shared.ServiceTypeRustAI,
		shared.ServiceTypeRustAnalytics,
		shared.ServiceTypeNodeBackend,
	}

	for _, service := range services {
		topic := fmt.Sprintf("service.%s", service)
		mb.natsConn.Subscribe(topic, func(msg *nats.Msg) {
			mb.handleNATSMessage(msg)
		})
		mb.logger.Info("Subscribed to NATS topic", zap.String("topic", topic))
	}

	// Subscribe to broadcast topic
	mb.natsConn.Subscribe("broadcast.*", func(msg *nats.Msg) {
		mb.handleNATSMessage(msg)
	})
}

func (mb *MessageBroker) handleNATSMessage(natsMsg *nats.Msg) {
	var msg shared.Message
	if err := json.Unmarshal(natsMsg.Data, &msg); err != nil {
		mb.logger.Error("Failed to unmarshal NATS message", zap.Error(err))
		return
	}

	mb.metrics.messagesReceived.WithLabelValues(string(msg.Source), string(msg.Type)).Inc()

	// Route message to appropriate destination
	if msg.Destination != "" {
		mb.forwardToService(msg.Destination, &msg)
	} else if msg.Type == shared.MessageTypeBroadcast {
		mb.broadcastMessage(&msg)
	}
}

func (mb *MessageBroker) websocketHandler(c *gin.Context) {
	serviceType := shared.ServiceType(c.Param("service"))
	
	conn, err := mb.wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		mb.logger.Error("Failed to upgrade WebSocket", zap.Error(err))
		return
	}

	// Store connection
	if oldConn, exists := mb.connections.LoadAndStore(serviceType, conn); exists {
		if old, ok := oldConn.(*websocket.Conn); ok {
			old.Close()
		}
	}

	mb.metrics.activeConnections.Inc()
	defer mb.metrics.activeConnections.Dec()

	mb.logger.Info("Service connected", zap.String("service", string(serviceType)))

	// Handle incoming messages
	for {
		var msg shared.Message
		if err := conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				mb.logger.Error("WebSocket error", zap.Error(err))
			}
			break
		}

		msg.Source = serviceType
		msg.Timestamp = time.Now()
		
		mb.processMessage(&msg)
	}

	// Clean up connection
	mb.connections.Delete(serviceType)
	conn.Close()
	mb.logger.Info("Service disconnected", zap.String("service", string(serviceType)))
}

func (mb *MessageBroker) processMessage(msg *shared.Message) {
	startTime := time.Now()
	defer func() {
		mb.metrics.processingLatency.WithLabelValues(
			string(msg.Source),
			string(msg.Destination),
		).Observe(time.Since(startTime).Seconds())
	}()

	mb.metrics.messagesReceived.WithLabelValues(string(msg.Source), string(msg.Type)).Inc()

	// Apply routing logic based on message type
	switch msg.Type {
	case shared.MessageTypeRequest:
		mb.routeRequest(msg)
	case shared.MessageTypeResponse:
		mb.routeResponse(msg)
	case shared.MessageTypeBroadcast:
		mb.broadcastMessage(msg)
	case shared.MessageTypeHealthCheck:
		mb.handleHealthCheck(msg)
	default:
		mb.logger.Warn("Unknown message type", zap.String("type", string(msg.Type)))
	}

	// Forward to NATS for persistence and external subscribers
	if data, err := json.Marshal(msg); err == nil {
		topic := fmt.Sprintf("service.%s", msg.Destination)
		mb.natsConn.Publish(topic, data)
	}
}

func (mb *MessageBroker) routeRequest(msg *shared.Message) {
	// Determine best destination based on request type
	if msg.Destination == "" {
		// Auto-route based on payload analysis
		msg.Destination = mb.determineDestination(msg)
	}

	mb.forwardToService(msg.Destination, msg)
}

func (mb *MessageBroker) routeResponse(msg *shared.Message) {
	// Route response back to original requester
	mb.forwardToService(msg.Destination, msg)
}

func (mb *MessageBroker) broadcastMessage(msg *shared.Message) {
	mb.connections.Range(func(key, value interface{}) bool {
		if conn, ok := value.(*websocket.Conn); ok {
			if err := conn.WriteJSON(msg); err != nil {
				mb.logger.Error("Failed to broadcast message",
					zap.String("service", string(key.(shared.ServiceType))),
					zap.Error(err))
			}
		}
		return true
	})
}

func (mb *MessageBroker) forwardToService(service shared.ServiceType, msg *shared.Message) {
	mb.metrics.messagesForwarded.WithLabelValues(string(service), string(msg.Type)).Inc()

	// Use resilience patterns for message forwarding
	operation := func() (interface{}, error) {
		if conn, exists := mb.connections.Load(service); exists {
			if wsConn, ok := conn.(*websocket.Conn); ok {
				return nil, wsConn.WriteJSON(msg)
			}
		}
		return nil, fmt.Errorf("service not connected: %s", string(service))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := mb.resilience.Execute(ctx, operation); err != nil {
		mb.logger.Error("Failed to forward message with resilience",
			zap.String("service", string(service)),
			zap.Error(err))
	}
}

func (mb *MessageBroker) determineDestination(msg *shared.Message) shared.ServiceType {
	// Analyze payload to determine appropriate service
	// This is a simplified version - implement more sophisticated routing logic
	
	var payload map[string]interface{}
	if err := json.Unmarshal(msg.Payload, &payload); err == nil {
		if _, hasImage := payload["image_data"]; hasImage {
			return shared.ServiceTypeRustVision
		}
		if _, hasModel := payload["model"]; hasModel {
			return shared.ServiceTypeRustAI
		}
	}

	// Default to Node.js backend
	return shared.ServiceTypeNodeBackend
}

func (mb *MessageBroker) handleHealthCheck(msg *shared.Message) {
	// Respond with broker health status
	health := shared.HealthStatus{
		Service:      shared.ServiceTypeGoMessageBroker,
		Status:       "healthy",
		LastChecked:  time.Now(),
		RequestCount: 0, // Would track this in production
	}

	healthData, _ := json.Marshal(health)
	response := &shared.Message{
		ID:          fmt.Sprintf("health-%d", time.Now().Unix()),
		Type:        shared.MessageTypeResponse,
		Source:      shared.ServiceTypeGoMessageBroker,
		Destination: msg.Source,
		Timestamp:   time.Now(),
		Payload:     healthData,
	}

	mb.forwardToService(msg.Source, response)
}

func (mb *MessageBroker) publishHandler(c *gin.Context) {
	var msg shared.Message
	if err := c.ShouldBindJSON(&msg); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	msg.Timestamp = time.Now()
	mb.processMessage(&msg)

	c.JSON(200, gin.H{"status": "published", "id": msg.ID})
}

func (mb *MessageBroker) healthCheckHandler(c *gin.Context) {
	activeConnections := 0
	mb.connections.Range(func(_, _ interface{}) bool {
		activeConnections++
		return true
	})

	resilienceMetrics := mb.resilience.GetMetrics()
	circuitBreakerStats := mb.resilience.GetCircuitBreakerStats()

	successRate := float64(0)
	if resilienceMetrics.TotalRequests > 0 {
		successRate = float64(resilienceMetrics.SuccessfulRequests) / float64(resilienceMetrics.TotalRequests) * 100
	}

	c.JSON(200, gin.H{
		"status":      "healthy",
		"service":     "message-broker",
		"connections": activeConnections,
		"nats":        mb.natsConn.Status().String(),
		"resilience": gin.H{
			"total_requests": resilienceMetrics.TotalRequests,
			"success_rate":   successRate,
			"circuit_breaker": circuitBreakerStats,
		},
	})
}

func (mb *MessageBroker) resilienceMetricsHandler(c *gin.Context) {
	metrics := mb.resilience.GetMetrics()
	cbStats := mb.resilience.GetCircuitBreakerStats()

	c.JSON(200, gin.H{
		"metrics": metrics,
		"circuit_breaker": cbStats,
	})
}

func main() {
	// Load configuration
	config, err := shared.LoadConfig("config.yaml")
	if err != nil {
		config = &shared.Config{
			Service: shared.ServiceConfig{
				Name:     "message-broker",
				LogLevel: "info",
			},
			HTTP: shared.HTTPConfig{
				Port: "8081",
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

	// Create and start broker
	broker, err := NewMessageBroker(config, logger)
	if err != nil {
		logger.Fatal("Failed to create message broker", zap.Error(err))
	}

	if err := broker.Start(); err != nil {
		logger.Fatal("Failed to start message broker", zap.Error(err))
	}
}