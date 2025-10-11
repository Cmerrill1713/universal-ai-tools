package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// =============================================================================
// ENHANCED METRICS DEFINITIONS
// =============================================================================

var (
	// AI Request metrics
	aiRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_requests_total",
			Help: "Total number of AI requests",
		},
		[]string{"service", "model", "status", "endpoint"},
	)

	aiRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "ai_request_duration_seconds",
			Help:    "AI request duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 10),
		},
		[]string{"service", "model", "endpoint"},
	)

	// AI Error metrics
	aiErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_errors_total",
			Help: "Total number of AI errors",
		},
		[]string{"service", "error_type", "severity"},
	)

	// AI Memory metrics
	aiMemoryUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_memory_usage_bytes",
			Help: "Memory usage of AI services",
		},
		[]string{"service", "component"},
	)

	aiMemoryLimit = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_memory_limit_bytes",
			Help: "Memory limit of AI services",
		},
		[]string{"service"},
	)

	// AI GPU metrics
	aiGPUUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_gpu_usage_percent",
			Help: "GPU usage percentage for AI services",
		},
		[]string{"service", "gpu_id"},
	)

	aiGPUMemoryUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_gpu_memory_usage_bytes",
			Help: "GPU memory usage in bytes",
		},
		[]string{"service", "gpu_id"},
	)

	aiGPUTemperature = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_gpu_temperature_celsius",
			Help: "GPU temperature in Celsius",
		},
		[]string{"service", "gpu_id"},
	)

	// AI CPU metrics
	aiCPUUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_cpu_usage_percent",
			Help: "CPU usage percentage for AI services",
		},
		[]string{"service", "cpu_id"},
	)

	// AI Service health
	aiServiceHealth = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_service_health",
			Help: "Health status of AI services (1=healthy, 0=unhealthy)",
		},
		[]string{"service"},
	)

	// Self-correction metrics
	aiSelfCorrectionsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_self_corrections_total",
			Help: "Total number of self-corrections performed",
		},
		[]string{"service", "correction_type", "success"},
	)

	// AI Model performance metrics
	aiModelInferencesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_model_inferences_total",
			Help: "Total number of model inferences",
		},
		[]string{"service", "model", "status"},
	)

	aiModelInferenceDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "ai_model_inference_duration_seconds",
			Help:    "Model inference duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.01, 2, 15),
		},
		[]string{"service", "model"},
	)

	aiModelAccuracyScore = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_model_accuracy_score",
			Help: "Model accuracy score (0-1)",
		},
		[]string{"service", "model", "dataset"},
	)

	aiModelConfidenceScore = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_model_confidence_score",
			Help: "Model confidence score (0-1)",
		},
		[]string{"service", "model"},
	)

	// AI Quality metrics
	aiOutputQualityScore = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_output_quality_score",
			Help: "AI output quality score (0-1)",
		},
		[]string{"service", "model", "quality_type"},
	)

	aiHallucinationsDetected = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_hallucinations_detected_total",
			Help: "Total number of hallucinations detected",
		},
		[]string{"service", "model", "hallucination_type"},
	)

	// AI Security metrics
	aiSecurityEventsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_security_events_total",
			Help: "Total number of security events",
		},
		[]string{"service", "event_type", "severity"},
	)

	aiAnomalyScore = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_anomaly_score",
			Help: "Anomaly detection score (0-1)",
		},
		[]string{"service", "anomaly_type"},
	)

	aiAnomaliesDetected = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_anomalies_detected_total",
			Help: "Total number of anomalies detected",
		},
		[]string{"service", "anomaly_type"},
	)

	// AI Business metrics
	aiCostPerRequest = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_cost_per_request_usd",
			Help: "Cost per request in USD",
		},
		[]string{"service", "model"},
	)

	aiTotalCost = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_total_cost_usd",
			Help: "Total cost in USD",
		},
		[]string{"service", "cost_type"},
	)

	aiTokensProcessedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_tokens_processed_total",
			Help: "Total number of tokens processed",
		},
		[]string{"service", "model", "token_type"},
	)

	aiUserSatisfactionScore = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_user_satisfaction_score",
			Help: "User satisfaction score (0-1)",
		},
		[]string{"service", "user_type"},
	)

	aiTasksStartedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_tasks_started_total",
			Help: "Total number of tasks started",
		},
		[]string{"service", "task_type"},
	)

	aiTasksCompletedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_tasks_completed_total",
			Help: "Total number of tasks completed",
		},
		[]string{"service", "task_type", "status"},
	)

	// AI Bias detection metrics
	aiBiasScore = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_bias_score",
			Help: "Bias detection score (0-1)",
		},
		[]string{"service", "model", "bias_type"},
	)

	aiBiasDetectionsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_bias_detections_total",
			Help: "Total number of bias detections",
		},
		[]string{"service", "model", "bias_type"},
	)
)

// =============================================================================
// SERVICE CONFIGURATION
// =============================================================================

type AIService struct {
	Name        string
	URL         string
	Models      []string
	Endpoints   []string
	MemoryLimit int64
}

type AIServicesConfig struct {
	Services []AIService `json:"services"`
}

// =============================================================================
// METRICS COLLECTOR
// =============================================================================

type MetricsCollector struct {
	services     []AIService
	httpClient   *http.Client
	mu           sync.RWMutex
	lastUpdate   time.Time
	updateTicker *time.Ticker
}

func NewMetricsCollector(configFile string) (*MetricsCollector, error) {
	// Load configuration
	config, err := loadConfig(configFile)
	if err != nil {
		log.Printf("Warning: Could not load config file %s, using defaults: %v", configFile, err)
		config = getDefaultConfig()
	}

	collector := &MetricsCollector{
		services:     config.Services,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		updateTicker: time.NewTicker(30 * time.Second),
	}

	// Register all metrics
	collector.registerMetrics()

	return collector, nil
}

func (mc *MetricsCollector) registerMetrics() {
	// Register all metrics with Prometheus
	prometheus.MustRegister(
		aiRequestsTotal,
		aiRequestDuration,
		aiErrorsTotal,
		aiMemoryUsage,
		aiMemoryLimit,
		aiGPUUsage,
		aiGPUMemoryUsage,
		aiGPUTemperature,
		aiCPUUsage,
		aiServiceHealth,
		aiSelfCorrectionsTotal,
		aiModelInferencesTotal,
		aiModelInferenceDuration,
		aiModelAccuracyScore,
		aiModelConfidenceScore,
		aiOutputQualityScore,
		aiHallucinationsDetected,
		aiSecurityEventsTotal,
		aiAnomalyScore,
		aiAnomaliesDetected,
		aiCostPerRequest,
		aiTotalCost,
		aiTokensProcessedTotal,
		aiUserSatisfactionScore,
		aiTasksStartedTotal,
		aiTasksCompletedTotal,
		aiBiasScore,
		aiBiasDetectionsTotal,
	)
}

func (mc *MetricsCollector) Start() {
	log.Println("Starting AI Metrics Collector...")

	// Start background metrics collection
	go mc.collectMetricsLoop()

	// Start HTTP server
	mc.startHTTPServer()
}

func (mc *MetricsCollector) collectMetricsLoop() {
	for {
		select {
		case <-mc.updateTicker.C:
			mc.collectMetrics()
		}
	}
}

func (mc *MetricsCollector) collectMetrics() {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	for _, service := range mc.services {
		mc.collectServiceMetrics(service)
	}

	mc.lastUpdate = time.Now()
}

func (mc *MetricsCollector) collectServiceMetrics(service AIService) {
	// Simulate realistic metrics collection
	// In a real implementation, this would make actual HTTP calls to services

	// Service health check
	healthy := mc.checkServiceHealth(service)
	aiServiceHealth.WithLabelValues(service.Name).Set(healthToFloat(healthy))

	if !healthy {
		aiErrorsTotal.WithLabelValues(service.Name, "health_check_failed", "warning").Inc()
		return
	}

	// Simulate request metrics
	requestCount := rand.Intn(100) + 50
	successCount := int(float64(requestCount) * (0.95 + rand.Float64()*0.04))
	errorCount := requestCount - successCount

	aiRequestsTotal.WithLabelValues(service.Name, "default", "success", "chat").Add(float64(successCount))
	if errorCount > 0 {
		aiRequestsTotal.WithLabelValues(service.Name, "default", "error", "chat").Add(float64(errorCount))
	}

	// Simulate response times
	responseTime := 0.5 + rand.Float64()*2.0
	aiRequestDuration.WithLabelValues(service.Name, "default", "chat").Observe(responseTime)

	// Simulate memory usage
	memoryUsage := float64(rand.Intn(500)+800) * 1024 * 1024 // 800MB - 1.3GB
	aiMemoryUsage.WithLabelValues(service.Name, "total").Set(memoryUsage)

	if service.MemoryLimit > 0 {
		aiMemoryLimit.WithLabelValues(service.Name).Set(float64(service.MemoryLimit))
	}

	// Simulate GPU usage
	gpuUsage := float64(rand.Intn(40) + 40) // 40-80%
	aiGPUUsage.WithLabelValues(service.Name, "0").Set(gpuUsage)

	gpuMemoryUsage := float64(rand.Intn(4000)+6000) * 1024 * 1024 // 6-10GB
	aiGPUMemoryUsage.WithLabelValues(service.Name, "0").Set(gpuMemoryUsage)

	gpuTemp := float64(rand.Intn(20) + 65) // 65-85°C
	aiGPUTemperature.WithLabelValues(service.Name, "0").Set(gpuTemp)

	// Simulate CPU usage
	cpuUsage := float64(rand.Intn(30) + 20) // 20-50%
	aiCPUUsage.WithLabelValues(service.Name, "0").Set(cpuUsage)

	// Simulate model inference metrics
	for _, model := range service.Models {
		inferenceCount := rand.Intn(20) + 10
		aiModelInferencesTotal.WithLabelValues(service.Name, model, "success").Add(float64(inferenceCount))

		inferenceDuration := 0.1 + rand.Float64()*1.0
		aiModelInferenceDuration.WithLabelValues(service.Name, model).Observe(inferenceDuration)

		accuracy := 0.85 + rand.Float64()*0.1
		aiModelAccuracyScore.WithLabelValues(service.Name, model, "validation").Set(accuracy)

		confidence := 0.8 + rand.Float64()*0.15
		aiModelConfidenceScore.WithLabelValues(service.Name, model).Set(confidence)
	}

	// Simulate self-corrections
	if rand.Float64() < 0.1 { // 10% chance of self-correction
		correctionTypes := []string{"grammar", "fact_check", "style", "clarity"}
		correctionType := correctionTypes[rand.Intn(len(correctionTypes))]
		success := rand.Float64() < 0.8 // 80% success rate

		aiSelfCorrectionsTotal.WithLabelValues(service.Name, correctionType, boolToString(success)).Inc()
	}

	// Simulate quality metrics
	qualityScore := 0.7 + rand.Float64()*0.25
	aiOutputQualityScore.WithLabelValues(service.Name, "default", "overall").Set(qualityScore)

	// Simulate security events (rare)
	if rand.Float64() < 0.01 { // 1% chance
		eventTypes := []string{"rate_limit_exceeded", "suspicious_input", "unauthorized_access"}
		eventType := eventTypes[rand.Intn(len(eventTypes))]
		severity := "warning"
		if eventType == "unauthorized_access" {
			severity = "critical"
		}

		aiSecurityEventsTotal.WithLabelValues(service.Name, eventType, severity).Inc()
	}

	// Simulate anomaly detection
	anomalyScore := rand.Float64()
	aiAnomalyScore.WithLabelValues(service.Name, "behavioral").Set(anomalyScore)

	if anomalyScore > 0.8 {
		aiAnomaliesDetected.WithLabelValues(service.Name, "behavioral").Inc()
	}

	// Simulate business metrics
	costPerRequest := 0.001 + rand.Float64()*0.005 // $0.001 - $0.006
	aiCostPerRequest.WithLabelValues(service.Name, "default").Set(costPerRequest)

	totalCost := costPerRequest * float64(requestCount)
	aiTotalCost.WithLabelValues(service.Name, "inference").Add(totalCost)

	// Simulate token processing
	tokensProcessed := requestCount * (rand.Intn(500) + 100) // 100-600 tokens per request
	aiTokensProcessedTotal.WithLabelValues(service.Name, "default", "input").Add(float64(tokensProcessed))
	aiTokensProcessedTotal.WithLabelValues(service.Name, "default", "output").Add(float64(tokensProcessed / 2))

	// Simulate user satisfaction
	satisfactionScore := 0.75 + rand.Float64()*0.2
	aiUserSatisfactionScore.WithLabelValues(service.Name, "general").Set(satisfactionScore)

	// Simulate task metrics
	tasksStarted := rand.Intn(10) + 5
	aiTasksStartedTotal.WithLabelValues(service.Name, "processing").Add(float64(tasksStarted))

	tasksCompleted := int(float64(tasksStarted) * (0.9 + rand.Float64()*0.08))
	aiTasksCompletedTotal.WithLabelValues(service.Name, "processing", "success").Add(float64(tasksCompleted))

	if tasksCompleted < tasksStarted {
		aiTasksCompletedTotal.WithLabelValues(service.Name, "processing", "failed").Add(float64(tasksStarted - tasksCompleted))
	}

	// Simulate bias detection
	if rand.Float64() < 0.05 { // 5% chance
		biasTypes := []string{"gender", "racial", "cultural", "age"}
		biasType := biasTypes[rand.Intn(len(biasTypes))]
		biasScore := 0.6 + rand.Float64()*0.3

		aiBiasScore.WithLabelValues(service.Name, "default", biasType).Set(biasScore)
		aiBiasDetectionsTotal.WithLabelValues(service.Name, "default", biasType).Inc()
	}
}

func (mc *MetricsCollector) checkServiceHealth(service AIService) bool {
	// In a real implementation, this would make an actual health check
	// For now, simulate 95% uptime
	return rand.Float64() < 0.95
}

func (mc *MetricsCollector) startHTTPServer() {
	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/health", mc.healthHandler)
	http.HandleFunc("/config", mc.configHandler)

	port := getEnv("METRICS_PORT", "9092")
	log.Printf("Starting AI Metrics Exporter on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func (mc *MetricsCollector) healthHandler(w http.ResponseWriter, r *http.Request) {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	response := map[string]interface{}{
		"service":            "ai-metrics-exporter",
		"status":             "healthy",
		"timestamp":          time.Now().UTC(),
		"last_update":        mc.lastUpdate.UTC(),
		"services_monitored": len(mc.services),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (mc *MetricsCollector) configHandler(w http.ResponseWriter, r *http.Request) {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	response := map[string]interface{}{
		"services":           mc.services,
		"metrics_registered": 25, // Count of registered metrics
		"update_interval":    "30s",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

func loadConfig(configFile string) (*AIServicesConfig, error) {
	data, err := os.ReadFile(configFile)
	if err != nil {
		return nil, err
	}

	var config AIServicesConfig
	err = json.Unmarshal(data, &config)
	return &config, err
}

func getDefaultConfig() *AIServicesConfig {
	return &AIServicesConfig{
		Services: []AIService{
			{
				Name:        "chat-service",
				URL:         "http://localhost:8010",
				Models:      []string{"mlx-qwen2.5-0.5b", "mlx-llama-3.1-8b"},
				Endpoints:   []string{"chat", "self-corrections"},
				MemoryLimit: 2 * 1024 * 1024 * 1024, // 2GB
			},
			{
				Name:        "mlx-service",
				URL:         "http://localhost:8001",
				Models:      []string{"mlx-qwen2.5-0.5b", "mlx-llama-3.1-8b"},
				Endpoints:   []string{"completions", "embeddings"},
				MemoryLimit: 4 * 1024 * 1024 * 1024, // 4GB
			},
			{
				Name:        "hrm-service",
				URL:         "http://localhost:8002",
				Models:      []string{"hrm-reasoning"},
				Endpoints:   []string{"reason", "analyze"},
				MemoryLimit: 1 * 1024 * 1024 * 1024, // 1GB
			},
			{
				Name:        "implementation-service",
				URL:         "http://localhost:8029",
				Models:      []string{"code-generation"},
				Endpoints:   []string{"implement", "debug"},
				MemoryLimit: 2 * 1024 * 1024 * 1024, // 2GB
			},
			{
				Name:        "research-service",
				URL:         "http://localhost:8028",
				Models:      []string{"research-ai"},
				Endpoints:   []string{"research", "summarize"},
				MemoryLimit: 3 * 1024 * 1024 * 1024, // 3GB
			},
		},
	}
}

func healthToFloat(healthy bool) float64 {
	if healthy {
		return 1.0
	}
	return 0.0
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

func main() {
	log.Println("Starting Enhanced AI Metrics Exporter...")

	configFile := getEnv("CONFIG_FILE", "/config/ai-services.yml")
	collector, err := NewMetricsCollector(configFile)
	if err != nil {
		log.Fatalf("Failed to create metrics collector: %v", err)
	}

	collector.Start()
}
