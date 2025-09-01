package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

// TracingService manages distributed tracing across Go and Rust services
type TracingService struct {
	logger   *zap.Logger
	tracer   trace.Tracer
	provider *sdktrace.TracerProvider
}

// TraceContext for cross-service propagation
type TraceContext struct {
	TraceID    string            `json:"trace_id"`
	SpanID     string            `json:"span_id"`
	ParentID   string            `json:"parent_id,omitempty"`
	Baggage    map[string]string `json:"baggage,omitempty"`
	Service    string            `json:"service"`
	Operation  string            `json:"operation"`
	StartTime  time.Time         `json:"start_time"`
	Attributes map[string]any    `json:"attributes,omitempty"`
}

// NewTracingService creates a new tracing service
func NewTracingService(logger *zap.Logger, serviceName string) (*TracingService, error) {
	// Create resource with service information
	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion("1.0.0"),
			attribute.String("environment", getEnv("ENVIRONMENT", "development")),
			attribute.String("language", "go"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create exporter based on configuration
	var exporter sdktrace.SpanExporter
	
	exporterType := getEnv("TRACE_EXPORTER", "jaeger")
	switch exporterType {
	case "jaeger":
		exporter, err = createJaegerExporter()
	case "otlp":
		exporter, err = createOTLPExporter()
	default:
		// Use stdout exporter for development
		exporter, err = sdktrace.NewExporter(os.Stdout)
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to create exporter: %w", err)
	}

	// Create tracer provider
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	// Set global tracer provider
	otel.SetTracerProvider(provider)
	
	// Set global propagator
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	tracer := provider.Tracer(serviceName)

	return &TracingService{
		logger:   logger,
		tracer:   tracer,
		provider: provider,
	}, nil
}

// createJaegerExporter creates a Jaeger exporter
func createJaegerExporter() (sdktrace.SpanExporter, error) {
	endpoint := getEnv("JAEGER_ENDPOINT", "http://localhost:14268/api/traces")
	return jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(endpoint)))
}

// createOTLPExporter creates an OTLP exporter
func createOTLPExporter() (sdktrace.SpanExporter, error) {
	endpoint := getEnv("OTLP_ENDPOINT", "localhost:4317")
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	conn, err := grpc.DialContext(ctx, endpoint,
		grpc.WithInsecure(),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create gRPC connection: %w", err)
	}

	return otlptrace.New(
		context.Background(),
		otlptracegrpc.NewClient(
			otlptracegrpc.WithGRPCConn(conn),
		),
	)
}

// StartSpan starts a new span
func (t *TracingService) StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return t.tracer.Start(ctx, name, opts...)
}

// ExtractContext extracts trace context from HTTP headers
func (t *TracingService) ExtractContext(c *gin.Context) context.Context {
	ctx := c.Request.Context()
	propagator := otel.GetTextMapPropagator()
	return propagator.Extract(ctx, propagation.HeaderCarrier(c.Request.Header))
}

// InjectContext injects trace context into HTTP headers
func (t *TracingService) InjectContext(ctx context.Context, headers http.Header) {
	propagator := otel.GetTextMapPropagator()
	propagator.Inject(ctx, propagation.HeaderCarrier(headers))
}

// CreateTraceContext creates a TraceContext from current span
func (t *TracingService) CreateTraceContext(ctx context.Context, service, operation string) *TraceContext {
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return nil
	}

	spanCtx := span.SpanContext()
	
	tc := &TraceContext{
		TraceID:    spanCtx.TraceID().String(),
		SpanID:     spanCtx.SpanID().String(),
		Service:    service,
		Operation:  operation,
		StartTime:  time.Now(),
		Attributes: make(map[string]any),
	}

	// Extract baggage
	baggage := propagation.Baggage{}.Extract(ctx, propagation.HeaderCarrier(http.Header{}))
	if baggage != nil {
		tc.Baggage = make(map[string]string)
		// Note: Actual baggage extraction would require more implementation
	}

	return tc
}

// Middleware returns Gin middleware for tracing
func (t *TracingService) Middleware() gin.HandlerFunc {
	return otelgin.Middleware(t.provider.Tracer("gin-server").Name)
}

// HandleGetTrace returns current trace information
func (t *TracingService) HandleGetTrace(c *gin.Context) {
	ctx := t.ExtractContext(c)
	span := trace.SpanFromContext(ctx)
	
	if !span.IsRecording() {
		c.JSON(http.StatusNotFound, gin.H{"error": "no active trace"})
		return
	}

	spanCtx := span.SpanContext()
	c.JSON(http.StatusOK, gin.H{
		"trace_id": spanCtx.TraceID().String(),
		"span_id":  spanCtx.SpanID().String(),
		"is_valid": spanCtx.IsValid(),
		"is_remote": spanCtx.IsRemote(),
		"trace_flags": spanCtx.TraceFlags().String(),
	})
}

// HandleCreateSpan creates a new span
func (t *TracingService) HandleCreateSpan(c *gin.Context) {
	var req struct {
		Name       string         `json:"name" binding:"required"`
		Attributes map[string]any `json:"attributes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := t.ExtractContext(c)
	
	// Create span with attributes
	attrs := make([]attribute.KeyValue, 0, len(req.Attributes))
	for k, v := range req.Attributes {
		switch val := v.(type) {
		case string:
			attrs = append(attrs, attribute.String(k, val))
		case float64:
			attrs = append(attrs, attribute.Float64(k, val))
		case bool:
			attrs = append(attrs, attribute.Bool(k, val))
		}
	}

	ctx, span := t.StartSpan(ctx, req.Name, trace.WithAttributes(attrs...))
	defer span.End()

	// Simulate some work
	time.Sleep(10 * time.Millisecond)
	
	span.AddEvent("Operation completed", trace.WithAttributes(
		attribute.String("status", "success"),
	))

	spanCtx := span.SpanContext()
	c.JSON(http.StatusOK, gin.H{
		"trace_id": spanCtx.TraceID().String(),
		"span_id":  spanCtx.SpanID().String(),
	})
}

// HandlePropagateTrace propagates trace to another service
func (t *TracingService) HandlePropagateTrace(c *gin.Context) {
	var req struct {
		ServiceURL string         `json:"service_url" binding:"required"`
		Operation  string         `json:"operation" binding:"required"`
		Payload    map[string]any `json:"payload"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := t.ExtractContext(c)
	ctx, span := t.StartSpan(ctx, fmt.Sprintf("call_%s", req.Operation))
	defer span.End()

	// Create HTTP request
	client := &http.Client{Timeout: 10 * time.Second}
	httpReq, err := http.NewRequestWithContext(ctx, "POST", req.ServiceURL, nil)
	if err != nil {
		span.RecordError(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Inject trace context into headers
	t.InjectContext(ctx, httpReq.Header)
	
	// Make the request
	resp, err := client.Do(httpReq)
	if err != nil {
		span.RecordError(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	span.SetAttributes(
		attribute.Int("http.status_code", resp.StatusCode),
		attribute.String("http.url", req.ServiceURL),
	)

	c.JSON(http.StatusOK, gin.H{
		"status": "trace propagated",
		"trace_id": span.SpanContext().TraceID().String(),
	})
}

// HandleBridgeToRust bridges trace context to Rust services
func (t *TracingService) HandleBridgeToRust(c *gin.Context) {
	ctx := t.ExtractContext(c)
	traceCtx := t.CreateTraceContext(ctx, "go-service", c.Request.URL.Path)
	
	if traceCtx == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no active trace"})
		return
	}

	// Convert to format Rust services expect
	rustTraceFormat := map[string]interface{}{
		"trace_id":   traceCtx.TraceID,
		"span_id":    traceCtx.SpanID,
		"parent_id":  traceCtx.ParentID,
		"service":    traceCtx.Service,
		"operation":  traceCtx.Operation,
		"timestamp":  traceCtx.StartTime.UnixNano(),
		"attributes": traceCtx.Attributes,
	}

	c.JSON(http.StatusOK, rustTraceFormat)
}

// Shutdown gracefully shuts down the tracing provider
func (t *TracingService) Shutdown(ctx context.Context) error {
	return t.provider.Shutdown(ctx)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	serviceName := getEnv("SERVICE_NAME", "universal-ai-tracing")
	
	// Initialize tracing
	tracingService, err := NewTracingService(logger, serviceName)
	if err != nil {
		logger.Fatal("Failed to initialize tracing", zap.Error(err))
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := tracingService.Shutdown(ctx); err != nil {
			logger.Error("Failed to shutdown tracing", zap.Error(err))
		}
	}()

	// Setup HTTP server
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(tracingService.Middleware())

	// API routes
	api := router.Group("/api/v1/tracing")
	{
		api.GET("/trace", tracingService.HandleGetTrace)
		api.POST("/span", tracingService.HandleCreateSpan)
		api.POST("/propagate", tracingService.HandlePropagateTrace)
		api.GET("/bridge/rust", tracingService.HandleBridgeToRust)
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status": "healthy",
				"service": serviceName,
				"timestamp": time.Now(),
			})
		})
	}

	// Example instrumented endpoint
	router.GET("/example", func(c *gin.Context) {
		ctx := c.Request.Context()
		
		// Start a custom span
		ctx, span := tracingService.StartSpan(ctx, "example.operation")
		defer span.End()

		// Add attributes
		span.SetAttributes(
			attribute.String("user.id", "123"),
			attribute.String("request.path", c.Request.URL.Path),
		)

		// Simulate some work
		time.Sleep(50 * time.Millisecond)
		
		// Add an event
		span.AddEvent("Processing completed")

		c.JSON(http.StatusOK, gin.H{
			"message": "Example endpoint with tracing",
			"trace_id": span.SpanContext().TraceID().String(),
		})
	})

	port := 8090
	if p := getEnv("PORT"); p != "" {
		fmt.Sscanf(p, "%d", &port)
	}

	logger.Info("Tracing service starting", 
		zap.String("service", serviceName),
		zap.Int("port", port))
	
	if err := router.Run(fmt.Sprintf(":%d", port)); err != nil {
		logger.Fatal("Server failed", zap.Error(err))
	}
}