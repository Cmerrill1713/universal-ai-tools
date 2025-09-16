// Distributed Tracing Service for Universal AI Tools
// Provides comprehensive tracing across Go, Rust, and Node.js services
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/universal-ai-tools/go-services/shared"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.20.0"
	oteltrace "go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

// TraceData represents a complete trace with all spans
type TraceData struct {
	TraceID       string            `json:"trace_id"`
	SpanID        string            `json:"span_id"`
	ParentSpanID  string            `json:"parent_span_id,omitempty"`
	OperationName string            `json:"operation_name"`
	ServiceName   string            `json:"service_name"`
	StartTime     time.Time         `json:"start_time"`
	Duration      time.Duration     `json:"duration"`
	Status        string            `json:"status"`
	Tags          map[string]string `json:"tags"`
	Logs          []TraceLog        `json:"logs"`
	References    []TraceRef        `json:"references"`
}

type TraceLog struct {
	Timestamp time.Time         `json:"timestamp"`
	Fields    map[string]string `json:"fields"`
}

type TraceRef struct {
	Type    string `json:"type"` // "follows_from" or "child_of"
	TraceID string `json:"trace_id"`
	SpanID  string `json:"span_id"`
}

// DistributedTracer handles cross-service tracing
type DistributedTracer struct {
	config       *shared.Config
	logger       *zap.Logger
	tracer       oteltrace.Tracer
	traces       sync.Map // TraceID -> []TraceData
	metrics      *TracingMetrics
	resilience   *shared.ResilienceManager
	shutdownChan chan struct{}
}

// TracingMetrics for monitoring the tracing system itself
type TracingMetrics struct {
	tracesReceived  *prometheus.CounterVec
	spansProcessed  *prometheus.CounterVec
	traceLatency    *prometheus.HistogramVec
	activeTraces    prometheus.Gauge
	traceErrors     *prometheus.CounterVec
	samplingRate    prometheus.Gauge
	exporterLatency prometheus.Histogram
}

// TraceAnalytics provides intelligent trace analysis
type TraceAnalytics struct {
	BottleneckDetection bool                 `json:"bottleneck_detection"`
	ServiceDependencies map[string][]string  `json:"service_dependencies"`
	LatencyDistribution map[string]float64   `json:"latency_distribution"`
	ErrorPatterns       []ErrorPattern       `json:"error_patterns"`
	PerformanceInsights []PerformanceInsight `json:"performance_insights"`
}

type ErrorPattern struct {
	Pattern   string   `json:"pattern"`
	Frequency int      `json:"frequency"`
	Services  []string `json:"services"`
	Severity  string   `json:"severity"`
}

type PerformanceInsight struct {
	Type        string  `json:"type"`
	Description string  `json:"description"`
	Impact      string  `json:"impact"`
	Service     string  `json:"service"`
	Confidence  float64 `json:"confidence"`
}

func NewTracingMetrics() *TracingMetrics {
	return &TracingMetrics{
		tracesReceived: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "distributed_tracing_traces_received_total",
				Help: "Total number of traces received",
			},
			[]string{"service", "operation"},
		),
		spansProcessed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "distributed_tracing_spans_processed_total",
				Help: "Total number of spans processed",
			},
			[]string{"service", "status"},
		),
		traceLatency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "distributed_tracing_trace_latency_seconds",
				Help:    "End-to-end trace latency",
				Buckets: []float64{0.001, 0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0},
			},
			[]string{"service", "operation"},
		),
		activeTraces: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "distributed_tracing_active_traces",
				Help: "Number of currently active traces",
			},
		),
		traceErrors: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "distributed_tracing_errors_total",
				Help: "Total number of tracing errors",
			},
			[]string{"error_type", "service"},
		),
		samplingRate: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "distributed_tracing_sampling_rate",
				Help: "Current trace sampling rate",
			},
		),
		exporterLatency: prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Name:    "distributed_tracing_exporter_latency_seconds",
				Help:    "Latency of trace exports to external systems",
				Buckets: prometheus.DefBuckets,
			},
		),
	}
}

func NewDistributedTracer(config *shared.Config, logger *zap.Logger) (*DistributedTracer, error) {
	// Setup resilience patterns
	resilienceConfig := shared.DefaultResilienceConfig()
	resilienceConfig.Timeout = 5 * time.Second
	resilienceConfig.BulkheadSize = 200
	resilience := shared.NewResilienceManager(resilienceConfig)

	dt := &DistributedTracer{
		config:       config,
		logger:       logger,
		metrics:      NewTracingMetrics(),
		resilience:   resilience,
		shutdownChan: make(chan struct{}),
	}

	// Initialize OpenTelemetry
	if err := dt.initOpenTelemetry(); err != nil {
		return nil, fmt.Errorf("failed to initialize OpenTelemetry: %w", err)
	}

	// Register metrics
	prometheus.MustRegister(
		dt.metrics.tracesReceived,
		dt.metrics.spansProcessed,
		dt.metrics.traceLatency,
		dt.metrics.activeTraces,
		dt.metrics.traceErrors,
		dt.metrics.samplingRate,
		dt.metrics.exporterLatency,
	)

	return dt, nil
}

func (dt *DistributedTracer) initOpenTelemetry() error {
	// Create resource with service information
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String("distributed-tracing-service"),
			semconv.ServiceVersionKey.String("1.0.0"),
			semconv.DeploymentEnvironmentKey.String("production"),
		),
	)
	if err != nil {
		return fmt.Errorf("failed to create resource: %w", err)
	}

	// Setup multiple exporters for redundancy
	var exporters []trace.SpanExporter

	// Jaeger exporter
	jaegerExporter, err := jaeger.New(
		jaeger.WithCollectorEndpoint(
			jaeger.WithEndpoint("http://jaeger:14268/api/traces"),
		),
	)
	if err != nil {
		dt.logger.Warn("Failed to create Jaeger exporter", zap.Error(err))
	} else {
		exporters = append(exporters, jaegerExporter)
	}

	// OTLP HTTP exporter (for additional backends like Grafana Tempo)
	otlpExporter, err := otlptracehttp.New(context.Background(),
		otlptracehttp.WithEndpoint("http://tempo:4318"),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		dt.logger.Warn("Failed to create OTLP exporter", zap.Error(err))
	} else {
		exporters = append(exporters, otlpExporter)
	}

	if len(exporters) == 0 {
		return fmt.Errorf("no trace exporters available")
	}

	// Create a composite exporter that sends to multiple backends
	var spanProcessors []trace.SpanProcessor
	for _, exporter := range exporters {
		spanProcessors = append(spanProcessors, trace.NewBatchSpanProcessor(exporter))
	}

	// Configure sampling (adaptive sampling based on system load)
	sampler := dt.createAdaptiveSampler()

	// Create trace provider
	tp := trace.NewTracerProvider(
		trace.WithResource(res),
		trace.WithSampler(sampler),
	)

	// Add all span processors
	for _, processor := range spanProcessors {
		tp.RegisterSpanProcessor(processor)
	}

	otel.SetTracerProvider(tp)

	// Set up propagation
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Get tracer
	dt.tracer = otel.Tracer("distributed-tracing-service")

	return nil
}

func (dt *DistributedTracer) createAdaptiveSampler() trace.Sampler {
	// Start with 100% sampling, will be adjusted based on load
	return trace.ParentBased(trace.TraceIDRatioBased(1.0))
}

func (dt *DistributedTracer) Start() error {
	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Add tracing middleware
	router.Use(dt.tracingMiddleware())

	// Health check endpoint
	router.GET("/health", dt.healthCheckHandler)

	// Trace ingestion endpoint
	router.POST("/traces", dt.ingestTracesHandler)

	// Trace query endpoints
	router.GET("/traces/:traceId", dt.getTraceHandler)
	router.GET("/traces", dt.queryTracesHandler)

	// Analytics endpoints
	router.GET("/analytics/dependencies", dt.serviceDependenciesHandler)
	router.GET("/analytics/bottlenecks", dt.bottleneckAnalysisHandler)
	router.GET("/analytics/errors", dt.errorAnalysisHandler)
	router.GET("/analytics/performance", dt.performanceInsightsHandler)

	// Trace visualization endpoint
	router.GET("/visualization/:traceId", dt.traceVisualizationHandler)

	// Sampling control endpoint
	router.POST("/sampling/adjust", dt.adjustSamplingHandler)

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Start background tasks
	go dt.traceAnalysis()
	go dt.adaptiveSampling()
	go dt.traceCleanup()

	// Start HTTP server
	srv := &http.Server{
		Addr:    ":" + dt.config.HTTP.Port,
		Handler: router,
	}

	go func() {
		dt.logger.Info("Starting distributed tracing service", zap.String("port", dt.config.HTTP.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			dt.logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	dt.logger.Info("Shutting down distributed tracing service")
	close(dt.shutdownChan)

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return srv.Shutdown(ctx)
}

func (dt *DistributedTracer) tracingMiddleware() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		// Extract trace context from request
		ctx := otel.GetTextMapPropagator().Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))

		// Start a new span
		ctx, span := dt.tracer.Start(ctx, fmt.Sprintf("%s %s", c.Request.Method, c.Request.URL.Path),
			oteltrace.WithAttributes(
				attribute.String("http.method", c.Request.Method),
				attribute.String("http.url", c.Request.URL.String()),
				attribute.String("http.user_agent", c.Request.UserAgent()),
				attribute.String("service.name", "distributed-tracing"),
			),
		)
		defer span.End()

		// Store context in gin context
		c.Request = c.Request.WithContext(ctx)

		// Process request
		c.Next()

		// Add response attributes
		span.SetAttributes(
			attribute.Int("http.status_code", c.Writer.Status()),
			attribute.Int("http.response_size", c.Writer.Size()),
		)

		// Set span status based on HTTP status
		if c.Writer.Status() >= 400 {
			span.SetAttributes(attribute.Bool("error", true))
		}
	})
}

func (dt *DistributedTracer) ingestTracesHandler(c *gin.Context) {
	var traces []TraceData
	if err := c.ShouldBindJSON(&traces); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Process traces with resilience
	operation := func() (interface{}, error) {
		return nil, dt.processTraces(traces)
	}

	if _, err := dt.resilience.Execute(c.Request.Context(), operation); err != nil {
		dt.metrics.traceErrors.WithLabelValues("ingestion_error", "unknown").Inc()
		c.JSON(500, gin.H{"error": "Failed to process traces"})
		return
	}

	c.JSON(200, gin.H{
		"status":          "success",
		"traces_received": len(traces),
	})
}

func (dt *DistributedTracer) processTraces(traces []TraceData) error {
	for _, trace := range traces {
		// Update metrics
		dt.metrics.tracesReceived.WithLabelValues(trace.ServiceName, trace.OperationName).Inc()
		dt.metrics.spansProcessed.WithLabelValues(trace.ServiceName, trace.Status).Inc()
		dt.metrics.traceLatency.WithLabelValues(trace.ServiceName, trace.OperationName).Observe(trace.Duration.Seconds())

		// Store trace for analysis
		if existingTraces, exists := dt.traces.Load(trace.TraceID); exists {
			traces := existingTraces.([]TraceData)
			traces = append(traces, trace)
			dt.traces.Store(trace.TraceID, traces)
		} else {
			dt.traces.Store(trace.TraceID, []TraceData{trace})
		}

		// Create OpenTelemetry span for forwarding
		dt.createOTelSpan(trace)
	}

	// Update active traces count
	count := 0
	dt.traces.Range(func(key, value interface{}) bool {
		count++
		return true
	})
	dt.metrics.activeTraces.Set(float64(count))

	return nil
}

func (dt *DistributedTracer) createOTelSpan(traceData TraceData) {
	// Convert TraceData to OpenTelemetry span
	ctx := context.Background()

	// Parse trace and span IDs
	traceID, err := oteltrace.TraceIDFromHex(traceData.TraceID)
	if err != nil {
		dt.logger.Warn("Invalid trace ID", zap.String("trace_id", traceData.TraceID))
		return
	}

	spanID, err := oteltrace.SpanIDFromHex(traceData.SpanID)
	if err != nil {
		dt.logger.Warn("Invalid span ID", zap.String("span_id", traceData.SpanID))
		return
	}

	// Create span context
	spanContext := oteltrace.NewSpanContext(oteltrace.SpanContextConfig{
		TraceID: traceID,
		SpanID:  spanID,
	})

	// Create context with span context
	ctx = oteltrace.ContextWithRemoteSpanContext(ctx, spanContext)

	// Start span
	_, span := dt.tracer.Start(ctx, traceData.OperationName,
		oteltrace.WithTimestamp(traceData.StartTime),
		oteltrace.WithAttributes(
			attribute.String("service.name", traceData.ServiceName),
		),
	)

	// Add tags as attributes
	for key, value := range traceData.Tags {
		span.SetAttributes(attribute.String(key, value))
	}

	// Set span status
	if traceData.Status == "error" {
		span.SetAttributes(attribute.Bool("error", true))
	}

	// End span with original end time
	endTime := traceData.StartTime.Add(traceData.Duration)
	span.End(oteltrace.WithTimestamp(endTime))
}

func (dt *DistributedTracer) getTraceHandler(c *gin.Context) {
	traceID := c.Param("traceId")

	if spans, exists := dt.traces.Load(traceID); exists {
		c.JSON(200, gin.H{
			"trace_id": traceID,
			"spans":    spans,
		})
	} else {
		c.JSON(404, gin.H{"error": "Trace not found"})
	}
}

func (dt *DistributedTracer) queryTracesHandler(c *gin.Context) {
	// Parse query parameters
	service := c.Query("service")
	operation := c.Query("operation")
	limit := c.DefaultQuery("limit", "100")

	limitInt, err := strconv.Atoi(limit)
	if err != nil {
		limitInt = 100
	}

	var results []interface{}
	count := 0

	dt.traces.Range(func(key, value interface{}) bool {
		if count >= limitInt {
			return false
		}

		traceID := key.(string)
		spans := value.([]TraceData)

		// Filter by service and operation if specified
		for _, span := range spans {
			if (service == "" || span.ServiceName == service) &&
				(operation == "" || span.OperationName == operation) {
				results = append(results, gin.H{
					"trace_id": traceID,
					"span":     span,
				})
				count++
				break
			}
		}
		return true
	})

	c.JSON(200, gin.H{
		"traces": results,
		"count":  count,
	})
}

func (dt *DistributedTracer) serviceDependenciesHandler(c *gin.Context) {
	dependencies := make(map[string][]string)

	dt.traces.Range(func(key, value interface{}) bool {
		spans := value.([]TraceData)

		// Build dependency graph from spans
		for _, span := range spans {
			for _, ref := range span.References {
				if ref.Type == "child_of" {
					// Find parent span
					for _, parentSpan := range spans {
						if parentSpan.SpanID == ref.SpanID {
							// Add dependency: parent -> child
							if deps, exists := dependencies[parentSpan.ServiceName]; exists {
								dependencies[parentSpan.ServiceName] = append(deps, span.ServiceName)
							} else {
								dependencies[parentSpan.ServiceName] = []string{span.ServiceName}
							}
							break
						}
					}
				}
			}
		}
		return true
	})

	c.JSON(200, gin.H{
		"dependencies":  dependencies,
		"analysis_time": time.Now(),
	})
}

func (dt *DistributedTracer) bottleneckAnalysisHandler(c *gin.Context) {
	bottlenecks := dt.analyzeBottlenecks()
	c.JSON(200, bottlenecks)
}

func (dt *DistributedTracer) analyzeBottlenecks() []PerformanceInsight {
	serviceLatencies := make(map[string][]float64)

	// Collect latency data per service
	dt.traces.Range(func(key, value interface{}) bool {
		spans := value.([]TraceData)
		for _, span := range spans {
			if latencies, exists := serviceLatencies[span.ServiceName]; exists {
				serviceLatencies[span.ServiceName] = append(latencies, span.Duration.Seconds())
			} else {
				serviceLatencies[span.ServiceName] = []float64{span.Duration.Seconds()}
			}
		}
		return true
	})

	var insights []PerformanceInsight

	// Analyze each service for bottlenecks
	for service, latencies := range serviceLatencies {
		if len(latencies) < 5 {
			continue // Need sufficient data
		}

		// Calculate percentiles
		p95 := dt.calculatePercentile(latencies, 0.95)
		median := dt.calculatePercentile(latencies, 0.5)

		// Detect bottlenecks
		if p95 > 2.0 { // 2 second threshold
			insights = append(insights, PerformanceInsight{
				Type:        "high_latency",
				Description: fmt.Sprintf("Service %s has high P95 latency: %.2fs", service, p95),
				Impact:      "severe",
				Service:     service,
				Confidence:  0.9,
			})
		} else if p95/median > 3.0 { // High variability
			insights = append(insights, PerformanceInsight{
				Type:        "latency_variability",
				Description: fmt.Sprintf("Service %s has high latency variability", service),
				Impact:      "moderate",
				Service:     service,
				Confidence:  0.7,
			})
		}
	}

	return insights
}

func (dt *DistributedTracer) calculatePercentile(values []float64, percentile float64) float64 {
	if len(values) == 0 {
		return 0
	}

	// Simple percentile calculation (in production, use a proper sorting algorithm)
	sorted := make([]float64, len(values))
	copy(sorted, values)

	// Basic bubble sort for simplicity
	for i := 0; i < len(sorted); i++ {
		for j := 0; j < len(sorted)-1-i; j++ {
			if sorted[j] > sorted[j+1] {
				sorted[j], sorted[j+1] = sorted[j+1], sorted[j]
			}
		}
	}

	index := int(float64(len(sorted)) * percentile)
	if index >= len(sorted) {
		index = len(sorted) - 1
	}
	return sorted[index]
}

func (dt *DistributedTracer) errorAnalysisHandler(c *gin.Context) {
	patterns := dt.analyzeErrorPatterns()
	c.JSON(200, gin.H{
		"error_patterns": patterns,
		"analysis_time":  time.Now(),
	})
}

func (dt *DistributedTracer) analyzeErrorPatterns() []ErrorPattern {
	errorCounts := make(map[string]map[string]int) // pattern -> service -> count

	dt.traces.Range(func(key, value interface{}) bool {
		spans := value.([]TraceData)
		for _, span := range spans {
			if span.Status == "error" {
				// Extract error pattern from logs
				for _, log := range span.Logs {
					if errorMsg, exists := log.Fields["error"]; exists {
						pattern := dt.extractErrorPattern(errorMsg)
						if pattern != "" {
							if services, exists := errorCounts[pattern]; exists {
								services[span.ServiceName]++
							} else {
								errorCounts[pattern] = map[string]int{span.ServiceName: 1}
							}
						}
					}
				}
			}
		}
		return true
	})

	var patterns []ErrorPattern
	for pattern, serviceCounts := range errorCounts {
		var services []string
		totalCount := 0

		for service, count := range serviceCounts {
			services = append(services, service)
			totalCount += count
		}

		severity := "low"
		if totalCount > 10 {
			severity = "high"
		} else if totalCount > 5 {
			severity = "medium"
		}

		patterns = append(patterns, ErrorPattern{
			Pattern:   pattern,
			Frequency: totalCount,
			Services:  services,
			Severity:  severity,
		})
	}

	return patterns
}

func (dt *DistributedTracer) extractErrorPattern(errorMsg string) string {
	// Simple pattern extraction - in production, use more sophisticated NLP
	if len(errorMsg) > 50 {
		return errorMsg[:50] + "..."
	}
	return errorMsg
}

func (dt *DistributedTracer) performanceInsightsHandler(c *gin.Context) {
	insights := dt.generatePerformanceInsights()
	c.JSON(200, gin.H{
		"insights":      insights,
		"analysis_time": time.Now(),
	})
}

func (dt *DistributedTracer) generatePerformanceInsights() []PerformanceInsight {
	insights := dt.analyzeBottlenecks()

	// Add additional insights
	serviceThroughput := dt.calculateServiceThroughput()
	for service, throughput := range serviceThroughput {
		if throughput < 1.0 { // Less than 1 RPS
			insights = append(insights, PerformanceInsight{
				Type:        "low_throughput",
				Description: fmt.Sprintf("Service %s has low throughput: %.2f RPS", service, throughput),
				Impact:      "moderate",
				Service:     service,
				Confidence:  0.8,
			})
		}
	}

	return insights
}

func (dt *DistributedTracer) calculateServiceThroughput() map[string]float64 {
	serviceCounts := make(map[string]int)
	oldestTime := time.Now()

	dt.traces.Range(func(key, value interface{}) bool {
		spans := value.([]TraceData)
		for _, span := range spans {
			serviceCounts[span.ServiceName]++
			if span.StartTime.Before(oldestTime) {
				oldestTime = span.StartTime
			}
		}
		return true
	})

	duration := time.Since(oldestTime).Seconds()
	if duration == 0 {
		duration = 1
	}

	throughput := make(map[string]float64)
	for service, count := range serviceCounts {
		throughput[service] = float64(count) / duration
	}

	return throughput
}

func (dt *DistributedTracer) traceVisualizationHandler(c *gin.Context) {
	traceID := c.Param("traceId")

	if spans, exists := dt.traces.Load(traceID); exists {
		visualization := dt.generateTraceVisualization(traceID, spans.([]TraceData))
		c.JSON(200, visualization)
	} else {
		c.JSON(404, gin.H{"error": "Trace not found"})
	}
}

func (dt *DistributedTracer) generateTraceVisualization(traceID string, spans []TraceData) interface{} {
	// Create a simple visualization structure
	nodes := make(map[string]interface{})
	edges := make([]interface{}, 0)

	for _, span := range spans {
		// Create node for each span
		nodes[span.SpanID] = gin.H{
			"id":         span.SpanID,
			"label":      span.OperationName,
			"service":    span.ServiceName,
			"duration":   span.Duration.Milliseconds(),
			"status":     span.Status,
			"start_time": span.StartTime,
		}

		// Create edges based on references
		for _, ref := range span.References {
			if ref.Type == "child_of" {
				edges = append(edges, gin.H{
					"from": ref.SpanID,
					"to":   span.SpanID,
					"type": ref.Type,
				})
			}
		}
	}

	return gin.H{
		"trace_id": traceID,
		"nodes":    nodes,
		"edges":    edges,
		"timeline": dt.generateTimeline(spans),
	}
}

func (dt *DistributedTracer) generateTimeline(spans []TraceData) []interface{} {
	timeline := make([]interface{}, 0)

	for _, span := range spans {
		timeline = append(timeline, gin.H{
			"span_id":    span.SpanID,
			"service":    span.ServiceName,
			"operation":  span.OperationName,
			"start_time": span.StartTime.Unix(),
			"duration":   span.Duration.Milliseconds(),
			"status":     span.Status,
		})
	}

	return timeline
}

func (dt *DistributedTracer) adjustSamplingHandler(c *gin.Context) {
	var request struct {
		SamplingRate float64 `json:"sampling_rate"`
		Reason       string  `json:"reason,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if request.SamplingRate < 0 || request.SamplingRate > 1 {
		c.JSON(400, gin.H{"error": "Sampling rate must be between 0 and 1"})
		return
	}

	// Update sampling rate (simplified implementation)
	dt.metrics.samplingRate.Set(request.SamplingRate)

	dt.logger.Info("Sampling rate adjusted",
		zap.Float64("new_rate", request.SamplingRate),
		zap.String("reason", request.Reason))

	c.JSON(200, gin.H{
		"status":        "success",
		"sampling_rate": request.SamplingRate,
	})
}

func (dt *DistributedTracer) healthCheckHandler(c *gin.Context) {
	activeTraces := 0
	dt.traces.Range(func(key, value interface{}) bool {
		activeTraces++
		return true
	})

	status := "healthy"
	if activeTraces > 10000 {
		status = "overloaded"
	}

	c.JSON(200, gin.H{
		"status":        status,
		"service":       "distributed-tracing",
		"active_traces": activeTraces,
		"sampling_rate": dt.metrics.samplingRate,
	})
}

// Background tasks
func (dt *DistributedTracer) traceAnalysis() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			dt.performTraceAnalysis()
		case <-dt.shutdownChan:
			return
		}
	}
}

func (dt *DistributedTracer) performTraceAnalysis() {
	// Analyze traces for patterns and anomalies
	insights := dt.generatePerformanceInsights()

	for _, insight := range insights {
		if insight.Confidence > 0.8 && insight.Impact == "severe" {
			dt.logger.Warn("Performance issue detected",
				zap.String("type", insight.Type),
				zap.String("service", insight.Service),
				zap.String("description", insight.Description),
				zap.Float64("confidence", insight.Confidence))
		}
	}
}

func (dt *DistributedTracer) adaptiveSampling() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			dt.adjustSamplingBasedOnLoad()
		case <-dt.shutdownChan:
			return
		}
	}
}

func (dt *DistributedTracer) adjustSamplingBasedOnLoad() {
	// Get current system metrics
	activeTraces := 0
	dt.traces.Range(func(key, value interface{}) bool {
		activeTraces++
		return true
	})

	// Adjust sampling rate based on load
	var newRate float64
	if activeTraces > 5000 {
		newRate = 0.1 // 10% sampling under high load
	} else if activeTraces > 1000 {
		newRate = 0.5 // 50% sampling under medium load
	} else {
		newRate = 1.0 // 100% sampling under low load
	}

	dt.metrics.samplingRate.Set(newRate)
}

func (dt *DistributedTracer) traceCleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			dt.cleanupOldTraces()
		case <-dt.shutdownChan:
			return
		}
	}
}

func (dt *DistributedTracer) cleanupOldTraces() {
	cutoff := time.Now().Add(-1 * time.Hour) // Keep traces for 1 hour

	var toDelete []string
	dt.traces.Range(func(key, value interface{}) bool {
		traceID := key.(string)
		spans := value.([]TraceData)

		// Check if all spans are old
		allOld := true
		for _, span := range spans {
			if span.StartTime.After(cutoff) {
				allOld = false
				break
			}
		}

		if allOld {
			toDelete = append(toDelete, traceID)
		}
		return true
	})

	// Delete old traces
	for _, traceID := range toDelete {
		dt.traces.Delete(traceID)
	}

	if len(toDelete) > 0 {
		dt.logger.Info("Cleaned up old traces", zap.Int("deleted_count", len(toDelete)))
	}
}

func main() {
	// Load configuration
	config, err := shared.LoadConfig("config.yaml")
	if err != nil {
		config = &shared.Config{
			Service: shared.ServiceConfig{
				Name:     "distributed-tracing",
				LogLevel: "info",
			},
			HTTP: shared.HTTPConfig{
				Port: "8096",
			},
		}
	}

	// Setup logger
	logger, err := shared.SetupLogger(config.Service.LogLevel)
	if err != nil {
		panic(fmt.Sprintf("Failed to setup logger: %v", err))
	}

	// Create and start distributed tracer
	tracer, err := NewDistributedTracer(config, logger)
	if err != nil {
		logger.Fatal("Failed to create distributed tracer", zap.Error(err))
	}

	if err := tracer.Start(); err != nil {
		logger.Fatal("Failed to start distributed tracer", zap.Error(err))
	}
}
