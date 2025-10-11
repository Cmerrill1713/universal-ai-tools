package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// =============================================================================
// METRICS DEFINITIONS
// =============================================================================

var (
	// AI Service Health Metrics
	aiServiceHealth = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_service_health",
			Help: "Health status of AI services (1=healthy, 0=unhealthy)",
		},
		[]string{"service", "endpoint"},
	)

	// AI Model Performance Metrics
	aiModelResponseTime = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "ai_model_response_time_seconds",
			Help:    "Response time for AI model inference",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15),
		},
		[]string{"model", "service"},
	)

	aiModelAccuracy = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_model_accuracy",
			Help: "Accuracy score for AI models",
		},
		[]string{"model", "dataset"},
	)

	// AI Request Metrics
	aiRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_requests_total",
			Help: "Total number of AI requests",
		},
		[]string{"service", "model", "status"},
	)

	aiRequestsDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "ai_requests_duration_seconds",
			Help:    "Duration of AI requests",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15),
		},
		[]string{"service", "model"},
	)

	// AI Error Metrics
	aiErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_errors_total",
			Help: "Total number of AI errors",
		},
		[]string{"service", "error_type"},
	)

	// AI Resource Usage Metrics
	aiMemoryUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_memory_usage_bytes",
			Help: "Memory usage of AI services",
		},
		[]string{"service", "component"},
	)

	aiGPUUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_gpu_usage_percent",
			Help: "GPU usage percentage for AI services",
		},
		[]string{"service", "gpu_id"},
	)

	// AI Model Metrics
	aiModelLoadTime = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "ai_model_load_time_seconds",
			Help:    "Time to load AI models",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 12),
		},
		[]string{"model", "service"},
	)

	aiModelInferenceCount = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_model_inference_count",
			Help: "Number of model inferences",
		},
		[]string{"model", "service"},
	)

	// AI Quality Metrics
	aiResponseQuality = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_response_quality_score",
			Help: "Quality score of AI responses (0-1)",
		},
		[]string{"service", "model", "metric_type"},
	)

	aiBiasScore = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_bias_score",
			Help: "Bias score for AI models (lower is better)",
		},
		[]string{"model", "bias_type"},
	)

	// AI Self-Correction Metrics
	aiSelfCorrectionsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_self_corrections_total",
			Help: "Total number of AI self-corrections",
		},
		[]string{"service", "correction_type"},
	)

	aiSelfCorrectionSuccessRate = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ai_self_correction_success_rate",
			Help: "Success rate of AI self-corrections",
		},
		[]string{"service"},
	)
)

// =============================================================================
// CONFIGURATION
// =============================================================================

type Config struct {
	ExportInterval string      `json:"export_interval"`
	MetricsPort    string      `json:"metrics_port"`
	Services       []AIService `json:"services"`
	LogLevel       string      `json:"log_level"`
}

type AIService struct {
	Name            string   `json:"name"`
	URL             string   `json:"url"`
	HealthEndpoint  string   `json:"health_endpoint"`
	MetricsEndpoint string   `json:"metrics_endpoint"`
	Models          []string `json:"models"`
}

// =============================================================================
// SERVICE MONITORING
// =============================================================================

type ServiceHealth struct {
	Service      string    `json:"service"`
	Healthy      bool      `json:"healthy"`
	LastCheck    time.Time `json:"last_check"`
	ResponseTime float64   `json:"response_time_ms"`
	Error        string    `json:"error,omitempty"`
}

type ServiceMetrics struct {
	Service      string  `json:"service"`
	MemoryUsage  int64   `json:"memory_usage_bytes"`
	GPUUsage     float64 `json:"gpu_usage_percent"`
	ActiveModels int     `json:"active_models"`
	QueueSize    int     `json:"queue_size"`
}

// =============================================================================
// MAIN APPLICATION
// =============================================================================

func main() {
	// Load configuration
	config := loadConfig()

	// Register metrics
	registerMetrics()

	// Start metrics collection
	go collectMetrics(config)

	// Start HTTP server
	http.Handle("/metrics", promhttp.Handler())
	http.Handle("/health", http.HandlerFunc(healthHandler))
	http.Handle("/config", http.HandlerFunc(configHandler(config)))

	log.Printf("Starting AI Metrics Exporter on port %s", config.MetricsPort)
	log.Fatal(http.ListenAndServe(":"+config.MetricsPort, nil))
}

func loadConfig() *Config {
	configFile := os.Getenv("AI_SERVICES_CONFIG")
	if configFile == "" {
		configFile = "/config/ai-services.yml"
	}

	// Default configuration
	config := &Config{
		ExportInterval: getEnv("EXPORT_INTERVAL", "10s"),
		MetricsPort:    getEnv("METRICS_PORT", "9092"),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		Services: []AIService{
			{
				Name:            "chat-service",
				URL:             "http://localhost:8010",
				HealthEndpoint:  "/health",
				MetricsEndpoint: "/metrics",
				Models:          []string{"mlx-qwen2.5-0.5b", "mlx-llama-3.1-8b"},
			},
			{
				Name:            "mlx-service",
				URL:             "http://localhost:8001",
				HealthEndpoint:  "/health",
				MetricsEndpoint: "/metrics",
				Models:          []string{"mlx-qwen2.5-0.5b", "mlx-llama-3.1-8b"},
			},
			{
				Name:            "hrm-service",
				URL:             "http://localhost:8002",
				HealthEndpoint:  "/health",
				MetricsEndpoint: "/metrics",
				Models:          []string{"hrm-reasoning"},
			},
			{
				Name:            "implementation-service",
				URL:             "http://localhost:8029",
				HealthEndpoint:  "/health",
				MetricsEndpoint: "/metrics",
				Models:          []string{"code-generation"},
			},
			{
				Name:            "research-service",
				URL:             "http://localhost:8028",
				HealthEndpoint:  "/health",
				MetricsEndpoint: "/metrics",
				Models:          []string{"research-ai"},
			},
		},
	}

	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func registerMetrics() {
	prometheus.MustRegister(aiServiceHealth)
	prometheus.MustRegister(aiModelResponseTime)
	prometheus.MustRegister(aiModelAccuracy)
	prometheus.MustRegister(aiRequestsTotal)
	prometheus.MustRegister(aiRequestsDuration)
	prometheus.MustRegister(aiErrorsTotal)
	prometheus.MustRegister(aiMemoryUsage)
	prometheus.MustRegister(aiGPUUsage)
	prometheus.MustRegister(aiModelLoadTime)
	prometheus.MustRegister(aiModelInferenceCount)
	prometheus.MustRegister(aiResponseQuality)
	prometheus.MustRegister(aiBiasScore)
	prometheus.MustRegister(aiSelfCorrectionsTotal)
	prometheus.MustRegister(aiSelfCorrectionSuccessRate)
}

func collectMetrics(config *Config) {
	interval, err := time.ParseDuration(config.ExportInterval)
	if err != nil {
		log.Printf("Invalid export interval: %v", err)
		interval = 10 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			collectServiceMetrics(config)
		}
	}
}

func collectServiceMetrics(config *Config) {
	for _, service := range config.Services {
		// Check service health
		health := checkServiceHealth(service)
		if health.Healthy {
			aiServiceHealth.WithLabelValues(service.Name, service.HealthEndpoint).Set(1)
		} else {
			aiServiceHealth.WithLabelValues(service.Name, service.HealthEndpoint).Set(0)
			aiErrorsTotal.WithLabelValues(service.Name, "health_check_failed").Inc()
		}

		// Collect service-specific metrics
		metrics := collectServiceSpecificMetrics(service)

		// Update metrics
		aiMemoryUsage.WithLabelValues(service.Name, "total").Set(float64(metrics.MemoryUsage))
		aiGPUUsage.WithLabelValues(service.Name, "0").Set(metrics.GPUUsage)

		// Simulate some AI-specific metrics
		for _, model := range service.Models {
			// Simulate response time (in production, this would come from actual metrics)
			responseTime := 0.1 + (float64(time.Now().UnixNano()%1000) / 10000.0)
			aiModelResponseTime.WithLabelValues(model, service.Name).Observe(responseTime)

			// Simulate accuracy scores
			accuracy := 0.85 + (float64(time.Now().UnixNano()%1500) / 10000.0)
			aiModelAccuracy.WithLabelValues(model, "test").Set(accuracy)

			// Simulate inference count
			aiModelInferenceCount.WithLabelValues(model, service.Name).Inc()

			// Simulate quality scores
			quality := 0.8 + (float64(time.Now().UnixNano()%2000) / 10000.0)
			aiResponseQuality.WithLabelValues(service.Name, model, "overall").Set(quality)
		}

		// Simulate self-correction metrics
		if service.Name == "chat-service" {
			aiSelfCorrectionsTotal.WithLabelValues(service.Name, "automatic").Inc()
			aiSelfCorrectionSuccessRate.WithLabelValues(service.Name).Set(0.92)
		}
	}
}

func checkServiceHealth(service AIService) ServiceHealth {
	start := time.Now()

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(service.URL + service.HealthEndpoint)
	responseTime := float64(time.Since(start).Nanoseconds()) / 1e6 // Convert to milliseconds

	if err != nil {
		return ServiceHealth{
			Service:      service.Name,
			Healthy:      false,
			LastCheck:    time.Now(),
			ResponseTime: responseTime,
			Error:        err.Error(),
		}
	}
	defer resp.Body.Close()

	healthy := resp.StatusCode == http.StatusOK

	return ServiceHealth{
		Service:      service.Name,
		Healthy:      healthy,
		LastCheck:    time.Now(),
		ResponseTime: responseTime,
		Error:        "",
	}
}

func collectServiceSpecificMetrics(service AIService) ServiceMetrics {
	// In production, this would make actual HTTP calls to collect metrics
	// For now, we'll simulate some realistic values

	return ServiceMetrics{
		Service:      service.Name,
		MemoryUsage:  int64(1000000000 + (time.Now().UnixNano() % 500000000)), // 1-1.5GB
		GPUUsage:     float64(30 + (time.Now().UnixNano() % 70)),              // 30-100%
		ActiveModels: len(service.Models),
		QueueSize:    int(time.Now().UnixNano() % 100),
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"service":   "ai-metrics-exporter",
	})
}

func configHandler(config *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(config)
	}
}
