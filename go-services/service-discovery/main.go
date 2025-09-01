package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hashicorp/consul/api"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

// ServiceDiscovery manages service registration and discovery with Consul
type ServiceDiscovery struct {
	consul         *api.Client
	logger         *zap.Logger
	config         *DiscoveryConfig
	registeredIDs  map[string]string // service name -> consul service ID
	healthCheckers map[string]*HealthChecker
	metrics        *DiscoveryMetrics
	mu             sync.RWMutex
}

type DiscoveryConfig struct {
	ConsulAddress    string
	DataCenter       string
	NodeName         string
	HealthCheckInterval time.Duration
	DeregisterTimeout   time.Duration
}

type ServiceInfo struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Address  string            `json:"address"`
	Port     int               `json:"port"`
	Tags     []string          `json:"tags"`
	Meta     map[string]string `json:"meta"`
	Health   string            `json:"health"`
	Language string            `json:"language"` // go, rust, node
	Type     string            `json:"type"`     // ml, cache, stream, etc.
}

type HealthChecker struct {
	ServiceID string
	URL       string
	Interval  time.Duration
	Timeout   time.Duration
	stopCh    chan struct{}
}

type DiscoveryMetrics struct {
	servicesRegistered   prometheus.Gauge
	healthChecksTotal    prometheus.Counter
	healthChecksFailed   prometheus.Counter
	serviceDiscoveries   prometheus.Counter
	registrationLatency  prometheus.Histogram
}

func NewDiscoveryMetrics() *DiscoveryMetrics {
	return &DiscoveryMetrics{
		servicesRegistered: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "service_discovery_registered_services",
			Help: "Number of registered services",
		}),
		healthChecksTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "service_discovery_health_checks_total",
			Help: "Total health checks performed",
		}),
		healthChecksFailed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "service_discovery_health_checks_failed_total",
			Help: "Failed health checks",
		}),
		serviceDiscoveries: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "service_discovery_lookups_total",
			Help: "Total service discovery lookups",
		}),
		registrationLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "service_discovery_registration_latency_seconds",
			Help:    "Service registration latency",
			Buckets: prometheus.DefBuckets,
		}),
	}
}

func NewServiceDiscovery(config *DiscoveryConfig, logger *zap.Logger) (*ServiceDiscovery, error) {
	consulConfig := api.DefaultConfig()
	consulConfig.Address = config.ConsulAddress
	consulConfig.Datacenter = config.DataCenter

	consul, err := api.NewClient(consulConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Consul client: %w", err)
	}

	sd := &ServiceDiscovery{
		consul:         consul,
		logger:         logger,
		config:         config,
		registeredIDs:  make(map[string]string),
		healthCheckers: make(map[string]*HealthChecker),
		metrics:        NewDiscoveryMetrics(),
	}

	// Register metrics
	prometheus.MustRegister(
		sd.metrics.servicesRegistered,
		sd.metrics.healthChecksTotal,
		sd.metrics.healthChecksFailed,
		sd.metrics.serviceDiscoveries,
		sd.metrics.registrationLatency,
	)

	return sd, nil
}

// RegisterService registers a service with Consul
func (sd *ServiceDiscovery) RegisterService(service ServiceInfo) error {
	start := time.Now()
	defer func() {
		sd.metrics.registrationLatency.Observe(time.Since(start).Seconds())
	}()

	sd.mu.Lock()
	defer sd.mu.Unlock()

	// Create Consul service definition
	consulService := &api.AgentServiceRegistration{
		ID:      service.ID,
		Name:    service.Name,
		Address: service.Address,
		Port:    service.Port,
		Tags:    append(service.Tags, fmt.Sprintf("language:%s", service.Language), fmt.Sprintf("type:%s", service.Type)),
		Meta:    service.Meta,
		Check: &api.AgentServiceCheck{
			HTTP:                           fmt.Sprintf("http://%s:%d/health", service.Address, service.Port),
			Interval:                       sd.config.HealthCheckInterval.String(),
			Timeout:                        "10s",
			DeregisterCriticalServiceAfter: sd.config.DeregisterTimeout.String(),
		},
	}

	// Register with Consul
	if err := sd.consul.Agent().ServiceRegister(consulService); err != nil {
		return fmt.Errorf("failed to register service %s: %w", service.Name, err)
	}

	sd.registeredIDs[service.Name] = service.ID
	sd.metrics.servicesRegistered.Inc()

	sd.logger.Info("Service registered",
		zap.String("id", service.ID),
		zap.String("name", service.Name),
		zap.String("address", service.Address),
		zap.Int("port", service.Port))

	return nil
}

// DeregisterService removes a service from Consul
func (sd *ServiceDiscovery) DeregisterService(serviceName string) error {
	sd.mu.Lock()
	defer sd.mu.Unlock()

	serviceID, exists := sd.registeredIDs[serviceName]
	if !exists {
		return fmt.Errorf("service %s not registered", serviceName)
	}

	// Stop health checker if running
	if checker, exists := sd.healthCheckers[serviceID]; exists {
		close(checker.stopCh)
		delete(sd.healthCheckers, serviceID)
	}

	// Deregister from Consul
	if err := sd.consul.Agent().ServiceDeregister(serviceID); err != nil {
		return fmt.Errorf("failed to deregister service %s: %w", serviceName, err)
	}

	delete(sd.registeredIDs, serviceName)
	sd.metrics.servicesRegistered.Dec()

	sd.logger.Info("Service deregistered",
		zap.String("name", serviceName),
		zap.String("id", serviceID))

	return nil
}

// DiscoverService finds all instances of a service
func (sd *ServiceDiscovery) DiscoverService(serviceName string) ([]ServiceInfo, error) {
	sd.metrics.serviceDiscoveries.Inc()

	services, _, err := sd.consul.Health().Service(serviceName, "", true, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to discover service %s: %w", serviceName, err)
	}

	var result []ServiceInfo
	for _, service := range services {
		tags := service.Service.Tags
		meta := service.Service.Meta

		// Extract language and type from tags
		language := extractTagValue(tags, "language")
		serviceType := extractTagValue(tags, "type")

		result = append(result, ServiceInfo{
			ID:       service.Service.ID,
			Name:     service.Service.Service,
			Address:  service.Service.Address,
			Port:     service.Service.Port,
			Tags:     tags,
			Meta:     meta,
			Health:   getHealthStatus(service.Checks),
			Language: language,
			Type:     serviceType,
		})
	}

	return result, nil
}

// DiscoverServicesByTag finds services with specific tags
func (sd *ServiceDiscovery) DiscoverServicesByTag(tag string) ([]ServiceInfo, error) {
	sd.metrics.serviceDiscoveries.Inc()

	services, _, err := sd.consul.Health().State(api.HealthPassing, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to discover services by tag %s: %w", tag, err)
	}

	var result []ServiceInfo
	for _, service := range services {
		if service.ServiceID == "" {
			continue // Skip node checks
		}

		// Get service details
		serviceDetails, _, err := sd.consul.Agent().Service(service.ServiceID, nil)
		if err != nil {
			continue
		}

		// Check if service has the required tag
		if containsTag(serviceDetails.Tags, tag) {
			language := extractTagValue(serviceDetails.Tags, "language")
			serviceType := extractTagValue(serviceDetails.Tags, "type")

			result = append(result, ServiceInfo{
				ID:       serviceDetails.ID,
				Name:     serviceDetails.Service,
				Address:  serviceDetails.Address,
				Port:     serviceDetails.Port,
				Tags:     serviceDetails.Tags,
				Meta:     serviceDetails.Meta,
				Health:   "passing",
				Language: language,
				Type:     serviceType,
			})
		}
	}

	return result, nil
}

// GetServiceEndpoint returns a load-balanced endpoint for a service
func (sd *ServiceDiscovery) GetServiceEndpoint(serviceName string) (string, error) {
	services, err := sd.DiscoverService(serviceName)
	if err != nil {
		return "", err
	}

	if len(services) == 0 {
		return "", fmt.Errorf("no healthy instances found for service %s", serviceName)
	}

	// Simple round-robin selection (could be improved with proper load balancing)
	service := services[0]
	return fmt.Sprintf("http://%s:%d", service.Address, service.Port), nil
}

// WatchService watches for changes in service instances
func (sd *ServiceDiscovery) WatchService(serviceName string, callback func([]ServiceInfo)) context.CancelFunc {
	ctx, cancel := context.WithCancel(context.Background())

	go func() {
		lastIndex := uint64(0)
		
		for {
			select {
			case <-ctx.Done():
				return
			default:
				// Watch for changes
				queryOptions := &api.QueryOptions{
					WaitIndex: lastIndex,
					WaitTime:  30 * time.Second,
				}

				services, meta, err := sd.consul.Health().Service(serviceName, "", false, queryOptions)
				if err != nil {
					sd.logger.Error("Failed to watch service", 
						zap.String("service", serviceName), 
						zap.Error(err))
					time.Sleep(5 * time.Second)
					continue
				}

				// Update last index
				lastIndex = meta.LastIndex

				// Convert to ServiceInfo
				var serviceInfos []ServiceInfo
				for _, service := range services {
					language := extractTagValue(service.Service.Tags, "language")
					serviceType := extractTagValue(service.Service.Tags, "type")

					serviceInfos = append(serviceInfos, ServiceInfo{
						ID:       service.Service.ID,
						Name:     service.Service.Service,
						Address:  service.Service.Address,
						Port:     service.Service.Port,
						Tags:     service.Service.Tags,
						Meta:     service.Service.Meta,
						Health:   getHealthStatus(service.Checks),
						Language: language,
						Type:     serviceType,
					})
				}

				// Notify callback
				callback(serviceInfos)
			}
		}
	}()

	return cancel
}

// HTTP Handlers

func (sd *ServiceDiscovery) handleRegisterService(c *gin.Context) {
	var service ServiceInfo
	if err := c.ShouldBindJSON(&service); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := sd.RegisterService(service); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "registered", "id": service.ID})
}

func (sd *ServiceDiscovery) handleDeregisterService(c *gin.Context) {
	serviceName := c.Param("name")
	
	if err := sd.DeregisterService(serviceName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deregistered"})
}

func (sd *ServiceDiscovery) handleDiscoverService(c *gin.Context) {
	serviceName := c.Param("name")
	
	services, err := sd.DiscoverService(serviceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, services)
}

func (sd *ServiceDiscovery) handleDiscoverByTag(c *gin.Context) {
	tag := c.Param("tag")
	
	services, err := sd.DiscoverServicesByTag(tag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, services)
}

func (sd *ServiceDiscovery) handleGetEndpoint(c *gin.Context) {
	serviceName := c.Param("name")
	
	endpoint, err := sd.GetServiceEndpoint(serviceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"endpoint": endpoint})
}

func (sd *ServiceDiscovery) handleListServices(c *gin.Context) {
	services, _, err := sd.consul.Catalog().Services(nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var result []map[string]interface{}
	for serviceName, tags := range services {
		result = append(result, map[string]interface{}{
			"name": serviceName,
			"tags": tags,
		})
	}

	c.JSON(http.StatusOK, result)
}

func (sd *ServiceDiscovery) handleHealth(c *gin.Context) {
	sd.mu.RLock()
	registeredCount := len(sd.registeredIDs)
	sd.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"status":             "healthy",
		"consul_address":     sd.config.ConsulAddress,
		"registered_services": registeredCount,
		"timestamp":          time.Now(),
	})
}

// Helper functions

func extractTagValue(tags []string, prefix string) string {
	prefixWithColon := prefix + ":"
	for _, tag := range tags {
		if len(tag) > len(prefixWithColon) && tag[:len(prefixWithColon)] == prefixWithColon {
			return tag[len(prefixWithColon):]
		}
	}
	return ""
}

func containsTag(tags []string, tag string) bool {
	for _, t := range tags {
		if t == tag {
			return true
		}
	}
	return false
}

func getHealthStatus(checks api.HealthChecks) string {
	if len(checks) == 0 {
		return "unknown"
	}

	for _, check := range checks {
		if check.Status == api.HealthCritical {
			return "critical"
		}
		if check.Status == api.HealthWarning {
			return "warning"
		}
	}

	return "passing"
}

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	config := &DiscoveryConfig{
		ConsulAddress:       getEnv("CONSUL_URL", "http://localhost:8500"),
		DataCenter:          getEnv("CONSUL_DATACENTER", "dc1"),
		NodeName:            getEnv("NODE_NAME", "universal-ai-discovery"),
		HealthCheckInterval: 10 * time.Second,
		DeregisterTimeout:   60 * time.Second,
	}

	sd, err := NewServiceDiscovery(config, logger)
	if err != nil {
		logger.Fatal("Failed to create service discovery", zap.Error(err))
	}

	// Setup HTTP server
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// API routes
	api := router.Group("/api/v1/discovery")
	{
		api.POST("/register", sd.handleRegisterService)
		api.DELETE("/deregister/:name", sd.handleDeregisterService)
		api.GET("/service/:name", sd.handleDiscoverService)
		api.GET("/tag/:tag", sd.handleDiscoverByTag)
		api.GET("/endpoint/:name", sd.handleGetEndpoint)
		api.GET("/services", sd.handleListServices)
		api.GET("/health", sd.handleHealth)
	}

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	port := 8094
	if p := getEnv("PORT"); p != "" {
		fmt.Sscanf(p, "%d", &port)
	}

	logger.Info("Service discovery starting", 
		zap.Int("port", port),
		zap.String("consul", config.ConsulAddress))
	
	if err := router.Run(fmt.Sprintf(":%d", port)); err != nil {
		logger.Fatal("Server failed", zap.Error(err))
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}