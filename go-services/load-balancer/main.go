package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"universal-ai-tools/go-services/shared"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

type LoadBalancer struct {
	config        *shared.Config
	logger        *zap.Logger
	services      map[shared.ServiceType]*ServiceEndpoint
	healthChecker *HealthChecker
	metrics       *LoadBalancerMetrics
	shutdownChan  chan struct{}
	mu            sync.RWMutex
}

type ServiceEndpoint struct {
	ServiceType  shared.ServiceType
	URL          *url.URL
	Proxy        *httputil.ReverseProxy
	Health       *shared.HealthStatus
	Active       bool
	Weight       int
	RequestCount int64
}

type HealthChecker struct {
	interval time.Duration
	timeout  time.Duration
	logger   *zap.Logger
}

type LoadBalancerMetrics struct {
	requestsTotal     *prometheus.CounterVec
	requestDuration   *prometheus.HistogramVec
	activeConnections *prometheus.GaugeVec
	serviceHealth     *prometheus.GaugeVec
	failedRequests    *prometheus.CounterVec
}

func NewLoadBalancerMetrics() *LoadBalancerMetrics {
	return &LoadBalancerMetrics{
		requestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "load_balancer_requests_total",
				Help: "Total number of requests handled",
			},
			[]string{"service", "method", "status"},
		),
		requestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "load_balancer_request_duration_seconds",
				Help:    "Request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"service", "method"},
		),
		activeConnections: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "load_balancer_active_connections",
				Help: "Number of active connections per service",
			},
			[]string{"service"},
		),
		serviceHealth: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "load_balancer_service_health",
				Help: "Service health status (1=healthy, 0=unhealthy)",
			},
			[]string{"service"},
		),
		failedRequests: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "load_balancer_failed_requests_total",
				Help: "Total number of failed requests",
			},
			[]string{"service", "reason"},
		),
	}
}

func NewLoadBalancer(config *shared.Config, logger *zap.Logger) (*LoadBalancer, error) {
	lb := &LoadBalancer{
		config:       config,
		logger:       logger,
		services:     make(map[shared.ServiceType]*ServiceEndpoint),
		metrics:      NewLoadBalancerMetrics(),
		shutdownChan: make(chan struct{}),
	}

	// Initialize service endpoints
	lb.initializeServices()

	// Create health checker
	lb.healthChecker = &HealthChecker{
		interval: time.Duration(config.Rust.HealthCheckInterval) * time.Second,
		timeout:  time.Duration(config.Rust.RequestTimeout) * time.Second,
		logger:   logger,
	}

	// Register metrics
	prometheus.MustRegister(
		lb.metrics.requestsTotal,
		lb.metrics.requestDuration,
		lb.metrics.activeConnections,
		lb.metrics.serviceHealth,
		lb.metrics.failedRequests,
	)

	return lb, nil
}

func (lb *LoadBalancer) initializeServices() {
	// Initialize Rust Vision Service
	if lb.config.Rust.VisionServiceURL != "" {
		if u, err := url.Parse(lb.config.Rust.VisionServiceURL); err == nil {
			lb.services[shared.ServiceTypeRustVision] = &ServiceEndpoint{
				ServiceType: shared.ServiceTypeRustVision,
				URL:         u,
				Proxy:       lb.createReverseProxy(u),
				Active:      true,
				Weight:      100,
			}
		}
	}

	// Initialize Rust AI Service
	if lb.config.Rust.AIServiceURL != "" {
		if u, err := url.Parse(lb.config.Rust.AIServiceURL); err == nil {
			lb.services[shared.ServiceTypeRustAI] = &ServiceEndpoint{
				ServiceType: shared.ServiceTypeRustAI,
				URL:         u,
				Proxy:       lb.createReverseProxy(u),
				Active:      true,
				Weight:      100,
			}
		}
	}

	// Initialize Rust Analytics Service
	if lb.config.Rust.AnalyticsServiceURL != "" {
		if u, err := url.Parse(lb.config.Rust.AnalyticsServiceURL); err == nil {
			lb.services[shared.ServiceTypeRustAnalytics] = &ServiceEndpoint{
				ServiceType: shared.ServiceTypeRustAnalytics,
				URL:         u,
				Proxy:       lb.createReverseProxy(u),
				Active:      true,
				Weight:      100,
			}
		}
	}

	// Initialize ML Services
	mlGoURL := os.Getenv("ML_GO_SERVICE")
	if mlGoURL == "" {
		mlGoURL = "http://localhost:8086"
	}
	if u, err := url.Parse(mlGoURL); err == nil {
		lb.services[shared.ServiceTypeMLGo] = &ServiceEndpoint{
			ServiceType: shared.ServiceTypeMLGo,
			URL:         u,
			Proxy:       lb.createReverseProxy(u),
			Active:      true,
			Weight:      100,
		}
	}

	mlRustURL := os.Getenv("ML_RUST_SERVICE")
	if mlRustURL == "" {
		mlRustURL = "http://localhost:8091"  // ML Inference service
	}
	if u, err := url.Parse(mlRustURL); err == nil {
		lb.services[shared.ServiceTypeMLRust] = &ServiceEndpoint{
			ServiceType: shared.ServiceTypeMLRust,
			URL:         u,
			Proxy:       lb.createReverseProxy(u),
			Active:      true,
			Weight:      100,
		}
	}

	// Initialize existing Go services that are actually running
	lb.addExistingServices()
}

func (lb *LoadBalancer) addExistingServices() {
	// Add our actually running services
	serviceConfigs := []struct {
		serviceType shared.ServiceType
		url         string
		weight      int
	}{
		{shared.ServiceTypeAPI, "http://localhost:8081", 100},      // API Gateway
		{shared.ServiceTypeAuth, "http://localhost:8015", 100},     // Auth Service
		{shared.ServiceTypeChat, "http://localhost:8016", 100},     // Chat Service
		{shared.ServiceTypeMemory, "http://localhost:8017", 100},   // Memory Service
		{shared.ServiceTypeWebSocket, "http://localhost:8018", 100}, // WebSocket Hub
		{shared.ServiceTypeGoCache, "http://localhost:8012", 100},    // Cache Coordinator
		{shared.ServiceTypeMetrics, "http://localhost:8013", 100},  // Metrics Aggregator
	}

	for _, config := range serviceConfigs {
		if u, err := url.Parse(config.url); err == nil {
			lb.services[config.serviceType] = &ServiceEndpoint{
				ServiceType: config.serviceType,
				URL:         u,
				Proxy:       lb.createReverseProxy(u),
				Active:      true,
				Weight:      config.weight,
			}
			lb.logger.Info("Added service to load balancer",
				zap.String("service", string(config.serviceType)),
				zap.String("url", config.url))
		} else {
			lb.logger.Warn("Failed to parse service URL",
				zap.String("service", string(config.serviceType)),
				zap.String("url", config.url),
				zap.Error(err))
		}
	}
}

func (lb *LoadBalancer) createReverseProxy(target *url.URL) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom director to add headers and modify request
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Header.Set("X-Forwarded-By", "go-load-balancer")
		req.Header.Set("X-Request-ID", fmt.Sprintf("%d", time.Now().UnixNano()))
	}

	// Custom error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		lb.logger.Error("Proxy error",
			zap.String("url", r.URL.String()),
			zap.Error(err))

		lb.metrics.failedRequests.WithLabelValues(target.Host, "proxy_error").Inc()

		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Service temporarily unavailable",
		})
	}

	// Custom modify response
	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Set("X-Load-Balancer", "go-lb")
		return nil
	}

	return proxy
}

func (lb *LoadBalancer) Start() error {
	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(lb.metricsMiddleware())

	// Health check endpoint
	router.GET("/health", lb.healthCheckHandler)

	// Service status endpoint
	router.GET("/services", lb.servicesStatusHandler)

	// Proxy routes for different services
	router.Any("/vision/*path", lb.proxyHandler(shared.ServiceTypeRustVision))
	router.Any("/ai/*path", lb.proxyHandler(shared.ServiceTypeRustAI))
	router.Any("/analytics/*path", lb.proxyHandler(shared.ServiceTypeRustAnalytics))

	// Generic proxy route
	router.Any("/proxy/:service/*path", lb.genericProxyHandler)

	// Metrics endpoint
	if lb.config.Metrics.Enabled {
		router.GET(lb.config.Metrics.Path, gin.WrapH(promhttp.Handler()))
	}

	// Start health checker
	go lb.startHealthChecker()

	// Start HTTP server
	srv := &http.Server{
		Addr:         ":" + lb.config.HTTP.Port,
		Handler:      router,
		ReadTimeout:  time.Duration(lb.config.HTTP.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(lb.config.HTTP.WriteTimeout) * time.Second,
	}

	// Start server in goroutine
	go func() {
		lb.logger.Info("Starting load balancer", zap.String("port", lb.config.HTTP.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			lb.logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	lb.logger.Info("Shutting down load balancer")
	close(lb.shutdownChan)

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return srv.Shutdown(ctx)
}

func (lb *LoadBalancer) startHealthChecker() {
	ticker := time.NewTicker(lb.healthChecker.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			lb.checkAllServices()
		case <-lb.shutdownChan:
			return
		}
	}
}

func (lb *LoadBalancer) checkAllServices() {
	lb.mu.RLock()
	services := make([]*ServiceEndpoint, 0, len(lb.services))
	for _, service := range lb.services {
		services = append(services, service)
	}
	lb.mu.RUnlock()

	var wg sync.WaitGroup
	for _, service := range services {
		wg.Add(1)
		go func(svc *ServiceEndpoint) {
			defer wg.Done()
			lb.checkServiceHealth(svc)
		}(service)
	}
	wg.Wait()
}

func (lb *LoadBalancer) checkServiceHealth(service *ServiceEndpoint) {
	ctx, cancel := context.WithTimeout(context.Background(), lb.healthChecker.timeout)
	defer cancel()

	healthURL := fmt.Sprintf("%s/health", service.URL.String())
	req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
	if err != nil {
		lb.updateServiceHealth(service, false, err)
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		lb.updateServiceHealth(service, false, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var health shared.HealthStatus
		if err := json.NewDecoder(resp.Body).Decode(&health); err == nil {
			service.Health = &health
		}
		lb.updateServiceHealth(service, true, nil)
	} else {
		lb.updateServiceHealth(service, false, fmt.Errorf("health check returned %d", resp.StatusCode))
	}
}

func (lb *LoadBalancer) updateServiceHealth(service *ServiceEndpoint, healthy bool, err error) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	service.Active = healthy

	if healthy {
		lb.metrics.serviceHealth.WithLabelValues(string(service.ServiceType)).Set(1)
		lb.logger.Debug("Service healthy", zap.String("service", string(service.ServiceType)))
	} else {
		lb.metrics.serviceHealth.WithLabelValues(string(service.ServiceType)).Set(0)
		lb.logger.Warn("Service unhealthy",
			zap.String("service", string(service.ServiceType)),
			zap.Error(err))
	}
}

func (lb *LoadBalancer) proxyHandler(serviceType shared.ServiceType) gin.HandlerFunc {
	return func(c *gin.Context) {
		lb.mu.RLock()
		service, exists := lb.services[serviceType]
		lb.mu.RUnlock()

		if !exists || !service.Active {
			lb.metrics.failedRequests.WithLabelValues(string(serviceType), "service_unavailable").Inc()
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": "Service unavailable",
			})
			return
		}

		// Increment request count
		atomic.AddInt64(&service.RequestCount, 1)
		lb.metrics.activeConnections.WithLabelValues(string(serviceType)).Inc()
		defer lb.metrics.activeConnections.WithLabelValues(string(serviceType)).Dec()

		// Proxy the request
		service.Proxy.ServeHTTP(c.Writer, c.Request)
	}
}

func (lb *LoadBalancer) genericProxyHandler(c *gin.Context) {
	serviceStr := c.Param("service")
	serviceType := shared.ServiceType(serviceStr)

	lb.proxyHandler(serviceType)(c)
}

func (lb *LoadBalancer) metricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start)
		status := fmt.Sprintf("%d", c.Writer.Status())

		// Extract service from path
		service := "unknown"
		if len(c.Request.URL.Path) > 1 {
			parts := bytes.Split([]byte(c.Request.URL.Path[1:]), []byte("/"))
			if len(parts) > 0 {
				service = string(parts[0])
			}
		}

		lb.metrics.requestsTotal.WithLabelValues(service, c.Request.Method, status).Inc()
		lb.metrics.requestDuration.WithLabelValues(service, c.Request.Method).Observe(duration.Seconds())
	}
}

func (lb *LoadBalancer) healthCheckHandler(c *gin.Context) {
	healthyServices := 0
	totalServices := 0

	lb.mu.RLock()
	for _, service := range lb.services {
		totalServices++
		if service.Active {
			healthyServices++
		}
	}
	lb.mu.RUnlock()

	status := "healthy"
	if healthyServices == 0 {
		status = "unhealthy"
	} else if healthyServices < totalServices {
		status = "degraded"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":           status,
		"service":          "load-balancer",
		"healthy_services": healthyServices,
		"total_services":   totalServices,
	})
}

func (lb *LoadBalancer) servicesStatusHandler(c *gin.Context) {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	services := make(map[string]interface{})
	for serviceType, service := range lb.services {
		services[string(serviceType)] = map[string]interface{}{
			"url":           service.URL.String(),
			"active":        service.Active,
			"weight":        service.Weight,
			"request_count": atomic.LoadInt64(&service.RequestCount),
			"health":        service.Health,
		}
	}

	c.JSON(http.StatusOK, services)
}

func main() {
	// Load configuration
	config, err := shared.LoadConfig("config.yaml")
	if err != nil {
		// Use defaults
		config = &shared.Config{
			Service: shared.ServiceConfig{
				Name:     "load-balancer",
				LogLevel: "info",
			},
			HTTP: shared.HTTPConfig{
				Port:         "8011",
				ReadTimeout:  30,
				WriteTimeout: 30,
			},
			Rust: shared.RustConfig{
				VisionServiceURL:    "http://localhost:8084",  // ML Inference
				AIServiceURL:        "http://localhost:3033",  // LLM Router
				AnalyticsServiceURL: "http://localhost:3032", // Parameter Analytics
				HealthCheckInterval: 30,
				RequestTimeout:      10,
			},
		}
	}

	// Setup logger
	logger, err := shared.SetupLogger(config.Service.LogLevel)
	if err != nil {
		panic(fmt.Sprintf("Failed to setup logger: %v", err))
	}

	// Create and start load balancer
	lb, err := NewLoadBalancer(config, logger)
	if err != nil {
		logger.Fatal("Failed to create load balancer", zap.Error(err))
	}

	if err := lb.Start(); err != nil {
		logger.Fatal("Failed to start load balancer", zap.Error(err))
	}
}
