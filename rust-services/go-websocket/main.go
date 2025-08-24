// WebSocket Service with OpenTelemetry Distributed Tracing
// High-performance Go service for real-time WebSocket connections

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

// Configuration
type Config struct {
	Port           string        `json:"port"`
	RedisURL       string        `json:"redis_url"`
	OTLPEndpoint   string        `json:"otlp_endpoint"`
	ServiceName    string        `json:"service_name"`
	ServiceVersion string        `json:"service_version"`
	Environment    string        `json:"environment"`
	MaxConnections int           `json:"max_connections"`
	PingInterval   time.Duration `json:"ping_interval"`
	WriteTimeout   time.Duration `json:"write_timeout"`
	ReadTimeout    time.Duration `json:"read_timeout"`
}

// WebSocket message types
type MessageType string

const (
	MessageTypeChat      MessageType = "chat"
	MessageTypeStatus    MessageType = "status"
	MessageTypeHeartbeat MessageType = "heartbeat"
	MessageTypeError     MessageType = "error"
	MessageTypeBroadcast MessageType = "broadcast"
)

// WebSocket message structure
type Message struct {
	ID        string                 `json:"id"`
	Type      MessageType            `json:"type"`
	From      string                 `json:"from"`
	To        string                 `json:"to,omitempty"`
	Content   string                 `json:"content"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// Client represents a WebSocket connection
type Client struct {
	ID       string
	Conn     *websocket.Conn
	Send     chan Message
	Hub      *Hub
	UserID   string
	LastSeen time.Time
	mu       sync.RWMutex
}

// Hub maintains active connections and handles message routing
type Hub struct {
	clients    map[string]*Client
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	redis      *redis.Client
	metrics    *Metrics
	tracer     trace.Tracer
	mu         sync.RWMutex
}

// Metrics collection
type Metrics struct {
	ConnectedClients   prometheus.Gauge
	MessagesTotal      *prometheus.CounterVec
	MessageDuration    *prometheus.HistogramVec
	ConnectionDuration *prometheus.HistogramVec
	ErrorsTotal        *prometheus.CounterVec
	RedisOperations    *prometheus.CounterVec
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: Could not load .env file: %v", err)
	}

	// Load configuration
	config := loadConfig()

	// Initialize OpenTelemetry tracing
	cleanup, err := initTracing(config)
	if err != nil {
		log.Fatalf("Failed to initialize tracing: %v", err)
	}
	defer cleanup()

	// Initialize metrics
	metrics := initMetrics()

	// Initialize Redis client with proper URL parsing
	redisAddr, err := parseRedisURL(config.RedisURL)
	if err != nil {
		log.Printf("Warning: Invalid Redis URL format: %v, using default", err)
		redisAddr = "127.0.0.1:6379"
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	// Test Redis connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
	} else {
		log.Println("Redis connection established")
	}

	// Create hub
	hub := &Hub{
		clients:    make(map[string]*Client),
		broadcast:  make(chan Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		redis:      redisClient,
		metrics:    metrics,
		tracer:     otel.Tracer("websocket-service"),
	}

	// Start hub
	go hub.run()

	// Initialize JWT authentication middleware
	authConfig := NewAuthConfig()
	authMiddleware := NewAuthMiddleware(authConfig, otel.Tracer("websocket-auth"))

	// Setup HTTP routes with OpenTelemetry instrumentation and JWT authentication
	mux := http.NewServeMux()

	// WebSocket endpoint (protected)
	mux.Handle("/ws", authMiddleware.Middleware(otelhttp.NewHandler(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleWebSocket(hub, w, r)
		}),
		"websocket_handler",
	)))

	// Health check endpoint (public)
	mux.Handle("/health", otelhttp.NewHandler(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleHealth(hub, w, r)
		}),
		"health_check",
	))

	// Metrics endpoint (public)
	mux.Handle("/metrics", promhttp.Handler())

	// Status endpoint (public)
	mux.Handle("/status", otelhttp.NewHandler(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleStatus(hub, w, r)
		}),
		"status_handler",
	))

	// Broadcast endpoint (protected, requires admin)
	mux.Handle("/broadcast", authMiddleware.RequireAdmin(otelhttp.NewHandler(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handleBroadcast(hub, w, r)
		}),
		"broadcast_handler",
	)))

	// Create HTTP server
	server := &http.Server{
		Addr:         ":" + config.Port,
		Handler:      mux,
		ReadTimeout:  config.ReadTimeout,
		WriteTimeout: config.WriteTimeout,
	}

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("WebSocket service starting on port %s", config.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down WebSocket service...")

	// Shutdown with timeout
	ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	// Close Redis connection
	if err := redisClient.Close(); err != nil {
		log.Printf("Redis close error: %v", err)
	}

	log.Println("WebSocket service stopped")
}

func loadConfig() *Config {
	return &Config{
		Port:           getEnv("WEBSOCKET_PORT", "8080"),
		RedisURL:       getEnv("REDIS_URL", "127.0.0.1:6379"),
		OTLPEndpoint:   getEnv("OTLP_ENDPOINT", "otel-collector:4317"),
		ServiceName:    getEnv("SERVICE_NAME", "websocket-service"),
		ServiceVersion: getEnv("SERVICE_VERSION", "1.0.0"),
		Environment:    getEnv("ENVIRONMENT", "development"),
		MaxConnections: 1000,
		PingInterval:   30 * time.Second,
		WriteTimeout:   10 * time.Second,
		ReadTimeout:    60 * time.Second,
	}
}

// getEnv function removed - using the one from auth.go

func parseRedisURL(redisURL string) (string, error) {
	// If it's already just an address, return it
	if !strings.Contains(redisURL, "://") {
		return redisURL, nil
	}

	// Parse the full URL
	u, err := url.Parse(redisURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	// Handle redis:// URLs
	if u.Scheme == "redis" {
		host := u.Hostname()
		port := u.Port()
		if port == "" {
			port = "6379" // Default Redis port
		}
		return fmt.Sprintf("%s:%s", host, port), nil
	}

	return "", fmt.Errorf("unsupported Redis URL scheme: %s", u.Scheme)
}

func initTracing(config *Config) (func(), error) {
	ctx := context.Background()

	// Create OTLP exporter
	exporter, err := otlptracegrpc.New(
		ctx,
		otlptracegrpc.WithEndpoint(config.OTLPEndpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	// Create resource
	res, err := resource.New(ctx,
		resource.WithAttributes(
			attribute.String("service.name", config.ServiceName),
			attribute.String("service.version", config.ServiceVersion),
			attribute.String("service.namespace", "universal-ai-tools"),
			attribute.String("deployment.environment", config.Environment),
			attribute.String("service.component", "websocket"),
			attribute.String("service.language", "go"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create trace provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	// Set global trace provider
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})

	log.Printf("OpenTelemetry tracing initialized for %s", config.ServiceName)

	// Return cleanup function
	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := tp.Shutdown(ctx); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}, nil
}

func initMetrics() *Metrics {
	metrics := &Metrics{
		ConnectedClients: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "websocket_connected_clients",
			Help: "Number of connected WebSocket clients",
		}),
		MessagesTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "websocket_messages_total",
			Help: "Total number of WebSocket messages",
		}, []string{"type", "status"}),
		MessageDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name: "websocket_message_duration_seconds",
			Help: "Time spent processing WebSocket messages",
		}, []string{"type"}),
		ConnectionDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name: "websocket_connection_duration_seconds",
			Help: "Duration of WebSocket connections",
		}, []string{"status"}),
		ErrorsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "websocket_errors_total",
			Help: "Total number of WebSocket errors",
		}, []string{"type"}),
		RedisOperations: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "websocket_redis_operations_total",
			Help: "Total number of Redis operations",
		}, []string{"operation", "status"}),
	}

	// Register metrics
	prometheus.MustRegister(metrics.ConnectedClients)
	prometheus.MustRegister(metrics.MessagesTotal)
	prometheus.MustRegister(metrics.MessageDuration)
	prometheus.MustRegister(metrics.ConnectionDuration)
	prometheus.MustRegister(metrics.ErrorsTotal)
	prometheus.MustRegister(metrics.RedisOperations)

	return metrics
}

func handleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	span := trace.SpanFromContext(ctx)

	span.SetAttributes(
		attribute.String("websocket.remote_addr", r.RemoteAddr),
		attribute.String("websocket.user_agent", r.UserAgent()),
	)

	// Upgrade connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to upgrade connection")
		hub.metrics.ErrorsTotal.WithLabelValues("upgrade").Inc()
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Extract user ID from query parameters or headers
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = fmt.Sprintf("anonymous_%d", time.Now().UnixNano())
	}

	// Create client
	client := &Client{
		ID:       fmt.Sprintf("client_%d", time.Now().UnixNano()),
		Conn:     conn,
		Send:     make(chan Message, 256),
		Hub:      hub,
		UserID:   userID,
		LastSeen: time.Now(),
	}

	span.SetAttributes(
		attribute.String("websocket.client_id", client.ID),
		attribute.String("websocket.user_id", userID),
	)

	// Register client
	hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump(ctx)

	span.SetStatus(codes.Ok, "WebSocket connection established")
	log.Printf("WebSocket client connected: %s (user: %s)", client.ID, userID)
}
