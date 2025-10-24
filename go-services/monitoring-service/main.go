package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// ServiceHealth represents the health status of a service
type ServiceHealth struct {
	Name         string         `json:"name"`
	Type         string         `json:"type"`
	URL          string         `json:"url"`
	Status       string         `json:"status"`
	LastChecked  time.Time      `json:"lastChecked"`
	ResponseTime int64          `json:"responseTime,omitempty"`
	Details      map[string]any `json:"details,omitempty"`
	Uptime       int64          `json:"uptime,omitempty"`
	RequestCount int64          `json:"requestCount,omitempty"`
}

// Alert represents a monitoring alert
type Alert struct {
	ID          string    `json:"id"`
	ServiceName string    `json:"serviceName"`
	Severity    string    `json:"severity"`
	Message     string    `json:"message"`
	Timestamp   time.Time `json:"timestamp"`
	Resolved    bool      `json:"resolved"`
}

// Metric represents a system metric
type Metric struct {
	Name      string            `json:"name"`
	Value     float64           `json:"value"`
	Labels    map[string]string `json:"labels"`
	Timestamp time.Time         `json:"timestamp"`
}

// MonitoringService handles all monitoring operations
type MonitoringService struct {
	services    map[string]*ServiceHealth
	alerts      []Alert
	metrics     []Metric
	db          *gorm.DB
	redis       *redis.Client
	mu          sync.RWMutex
	checkTicker *time.Ticker
	stopChan    chan bool

	// Prometheus metrics
	serviceHealthGauge    *prometheus.GaugeVec
	responseTimeHistogram *prometheus.HistogramVec
	alertCounter          *prometheus.CounterVec
}

// NewMonitoringService creates a new monitoring service
func NewMonitoringService() (*MonitoringService, error) {
	// Initialize database connection
	db, err := initDatabase()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	// Initialize Redis connection
	rdb := redis.NewClient(&redis.Options{
		Addr:     getEnv("REDIS_URL", "localhost:6379"),
		Password: "",
		DB:       0,
	})

	// Initialize Prometheus metrics
	serviceHealthGauge := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "service_health_status",
			Help: "Health status of monitored services",
		},
		[]string{"service_name", "service_type", "status"},
	)

	responseTimeHistogram := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "service_response_time_seconds",
			Help:    "Response time of monitored services",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service_name", "service_type"},
	)

	alertCounter := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "monitoring_alerts_total",
			Help: "Total number of monitoring alerts",
		},
		[]string{"service_name", "severity"},
	)

	// Register metrics
	prometheus.MustRegister(serviceHealthGauge)
	prometheus.MustRegister(responseTimeHistogram)
	prometheus.MustRegister(alertCounter)

	return &MonitoringService{
		services:              make(map[string]*ServiceHealth),
		alerts:                make([]Alert, 0),
		metrics:               make([]Metric, 0),
		db:                    db,
		redis:                 rdb,
		stopChan:              make(chan bool),
		serviceHealthGauge:    serviceHealthGauge,
		responseTimeHistogram: responseTimeHistogram,
		alertCounter:          alertCounter,
	}, nil
}

// Start begins the monitoring service
func (ms *MonitoringService) Start() error {
	// Initialize service definitions
	ms.initializeServices()

	// Start health check ticker
	ms.checkTicker = time.NewTicker(30 * time.Second)

	go ms.runHealthChecks()

	log.Println("Monitoring service started")
	return nil
}

// Stop stops the monitoring service
func (ms *MonitoringService) Stop() {
	if ms.checkTicker != nil {
		ms.checkTicker.Stop()
	}
	ms.stopChan <- true
	log.Println("Monitoring service stopped")
}

// initializeServices sets up the initial service definitions
func (ms *MonitoringService) initializeServices() {
	services := []ServiceHealth{
		// Rust Services
		{Name: "Rust Auth Service", Type: "rust", URL: "http://localhost:8016/health"},
		{Name: "Parameter Analytics Service", Type: "rust", URL: "http://localhost:8028/health"},
		{Name: "Fast LLM Coordinator", Type: "rust", URL: "http://localhost:8021/health"},
		{Name: "Intelligent Parameter Service", Type: "rust", URL: "http://localhost:8022/health"},
		{Name: "AB-MCTS Service", Type: "rust", URL: "http://localhost:8023/health"},
		{Name: "Vision Resource Manager", Type: "rust", URL: "http://localhost:8024/health"},
		{Name: "Redis Service", Type: "rust", URL: "http://localhost:8025/health"},

		// Go Services
		{Name: "Go API Gateway", Type: "go", URL: "http://localhost:8081/health"},
		{Name: "Go Auth Service", Type: "go", URL: "http://localhost:8015/health"},
		{Name: "Go Memory Service", Type: "go", URL: "http://localhost:8017/health"},
		{Name: "Go WebSocket Service", Type: "go", URL: "http://localhost:8014/health"},
		{Name: "Go File Management", Type: "go", URL: "http://localhost:8019/health"},
	}

	ms.mu.Lock()
	defer ms.mu.Unlock()

	for _, service := range services {
		service.Status = "unknown"
		service.LastChecked = time.Now()
		ms.services[service.Name] = &service
	}
}

// runHealthChecks performs periodic health checks
func (ms *MonitoringService) runHealthChecks() {
	for {
		select {
		case <-ms.checkTicker.C:
			ms.performHealthChecks()
		case <-ms.stopChan:
			return
		}
	}
}

// performHealthChecks checks the health of all services
func (ms *MonitoringService) performHealthChecks() {
	ms.mu.RLock()
	services := make([]*ServiceHealth, 0, len(ms.services))
	for _, service := range ms.services {
		services = append(services, service)
	}
	ms.mu.RUnlock()

	for _, service := range services {
		go ms.checkServiceHealth(service)
	}
}

// checkServiceHealth checks the health of a single service
func (ms *MonitoringService) checkServiceHealth(service *ServiceHealth) {
	start := time.Now()

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(service.URL)
	responseTime := time.Since(start).Milliseconds()

	ms.mu.Lock()
	defer ms.mu.Unlock()

	if err != nil {
		service.Status = "down"
		ms.createAlert(service.Name, "error", fmt.Sprintf("Service unreachable: %v", err))
	} else {
		resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			service.Status = "healthy"
		} else {
			service.Status = "degraded"
			ms.createAlert(service.Name, "warning", fmt.Sprintf("Service returned status %d", resp.StatusCode))
		}
	}

	service.LastChecked = time.Now()
	service.ResponseTime = responseTime

	// Update Prometheus metrics
	ms.serviceHealthGauge.WithLabelValues(service.Name, service.Type, service.Status).Set(1)
	ms.responseTimeHistogram.WithLabelValues(service.Name, service.Type).Observe(float64(responseTime) / 1000)
}

// createAlert creates a new alert
func (ms *MonitoringService) createAlert(serviceName, severity, message string) {
	alert := Alert{
		ID:          fmt.Sprintf("%d", time.Now().UnixNano()),
		ServiceName: serviceName,
		Severity:    severity,
		Message:     message,
		Timestamp:   time.Now(),
		Resolved:    false,
	}

	ms.alerts = append(ms.alerts, alert)
	ms.alertCounter.WithLabelValues(serviceName, severity).Inc()

	// Store in database
	ms.db.Create(&alert)
}

// GetHealthStatus returns the current health status of all services
func (ms *MonitoringService) GetHealthStatus() map[string]*ServiceHealth {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	result := make(map[string]*ServiceHealth)
	for name, service := range ms.services {
		result[name] = service
	}
	return result
}

// GetAlerts returns all alerts
func (ms *MonitoringService) GetAlerts() []Alert {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	return ms.alerts
}

// GetMetrics returns all metrics
func (ms *MonitoringService) GetMetrics() []Metric {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	return ms.metrics
}

// initDatabase initializes the database connection
func initDatabase() (*gorm.DB, error) {
	dsn := getEnv("DATABASE_URL", "postgres://user:password@localhost/universal_ai_tools?sslmode=disable")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(&Alert{}, &Metric{})
	if err != nil {
		return nil, err
	}

	return db, nil
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// HTTP Handlers

// setupRoutes sets up the HTTP routes
func setupRoutes(ms *MonitoringService) *gin.Engine {
	r := gin.Default()

	// Health endpoints
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// Monitoring endpoints
	r.GET("/api/v1/monitoring/health", func(c *gin.Context) {
		status := ms.GetHealthStatus()
		c.JSON(http.StatusOK, status)
	})

	r.GET("/api/v1/monitoring/alerts", func(c *gin.Context) {
		alerts := ms.GetAlerts()
		c.JSON(http.StatusOK, alerts)
	})

	r.GET("/api/v1/monitoring/metrics", func(c *gin.Context) {
		metrics := ms.GetMetrics()
		c.JSON(http.StatusOK, metrics)
	})

	// Prometheus metrics endpoint
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	return r
}

func main() {
	// Initialize monitoring service
	ms, err := NewMonitoringService()
	if err != nil {
		log.Fatalf("Failed to create monitoring service: %v", err)
	}

	// Start monitoring
	if err := ms.Start(); err != nil {
		log.Fatalf("Failed to start monitoring service: %v", err)
	}
	defer ms.Stop()

	// Setup HTTP routes
	router := setupRoutes(ms)

	// Start HTTP server
	port := getEnv("PORT", "8030")
	log.Printf("Starting monitoring service on port %s", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start HTTP server: %v", err)
	}
}
