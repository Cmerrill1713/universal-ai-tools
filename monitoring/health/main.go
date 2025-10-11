package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"
)

// =============================================================================
// CONFIGURATION
// =============================================================================

type Config struct {
	CheckInterval      string    `json:"check_interval"`
	FailureThreshold   int       `json:"failure_threshold"`
	RecoveryAction     string    `json:"recovery_action"`
	HealthCheckTimeout string    `json:"health_check_timeout"`
	LogLevel           string    `json:"log_level"`
	AlertWebhookURL    string    `json:"alert_webhook_url"`
	Services           []Service `json:"services"`
	DockerEnabled      bool      `json:"docker_enabled"`
}

type Service struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	HealthPath  string `json:"health_path"`
	Timeout     int    `json:"timeout"`
	Retries     int    `json:"retries"`
	Critical    bool   `json:"critical"`
	ContainerID string `json:"container_id,omitempty"`
}

type HealthStatus struct {
	Service      string    `json:"service"`
	Healthy      bool      `json:"healthy"`
	LastCheck    time.Time `json:"last_check"`
	ResponseTime int64     `json:"response_time_ms"`
	Error        string    `json:"error,omitempty"`
	Failures     int       `json:"consecutive_failures"`
	LastHealthy  time.Time `json:"last_healthy,omitempty"`
}

type Alert struct {
	Type      string    `json:"type"`
	Service   string    `json:"service"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Severity  string    `json:"severity"`
}

// =============================================================================
// HEALTH MONITOR
// =============================================================================

type HealthMonitor struct {
	config       *Config
	dockerClient *client.Client
	statuses     map[string]*HealthStatus
	statusMutex  sync.RWMutex
	httpClient   *http.Client
	alertChannel chan Alert
}

func NewHealthMonitor(config *Config) (*HealthMonitor, error) {
	var dockerClient *client.Client
	var err error

	if config.DockerEnabled {
		dockerClient, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Printf("Warning: Failed to initialize Docker client: %v", err)
		}
	}

	timeout, err := time.ParseDuration(config.HealthCheckTimeout)
	if err != nil {
		timeout = 10 * time.Second
	}

	hm := &HealthMonitor{
		config:       config,
		dockerClient: dockerClient,
		statuses:     make(map[string]*HealthStatus),
		httpClient: &http.Client{
			Timeout: timeout,
		},
		alertChannel: make(chan Alert, 100),
	}

	// Initialize statuses
	for _, service := range config.Services {
		hm.statuses[service.Name] = &HealthStatus{
			Service:      service.Name,
			Healthy:      false,
			LastCheck:    time.Time{},
			ResponseTime: 0,
			Failures:     0,
		}
	}

	return hm, nil
}

func (hm *HealthMonitor) Start() {
	log.Println("Starting Health Monitor...")

	// Start health checking goroutine
	go hm.healthCheckLoop()

	// Start alert processing goroutine
	go hm.alertProcessor()

	// Start HTTP server
	hm.startHTTPServer()
}

func (hm *HealthMonitor) healthCheckLoop() {
	interval, err := time.ParseDuration(hm.config.CheckInterval)
	if err != nil {
		log.Printf("Invalid check interval: %v", err)
		interval = 30 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			hm.checkAllServices()
		}
	}
}

func (hm *HealthMonitor) checkAllServices() {
	var wg sync.WaitGroup

	for _, service := range hm.config.Services {
		wg.Add(1)
		go func(svc Service) {
			defer wg.Done()
			hm.checkService(svc)
		}(service)
	}

	wg.Wait()
}

func (hm *HealthMonitor) checkService(service Service) {
	start := time.Now()

	// Check HTTP endpoint
	healthy, err := hm.checkHTTPHealth(service)
	responseTime := time.Since(start).Milliseconds()

	hm.statusMutex.Lock()
	status := hm.statuses[service.Name]
	status.LastCheck = time.Now()
	status.ResponseTime = responseTime

	if healthy {
		if status.Failures > 0 {
			// Service recovered
			log.Printf("✅ Service %s recovered after %d failures", service.Name, status.Failures)
			hm.alertChannel <- Alert{
				Type:      "recovery",
				Service:   service.Name,
				Message:   fmt.Sprintf("Service recovered after %d consecutive failures", status.Failures),
				Timestamp: time.Now(),
				Severity:  "info",
			}
		}
		status.Healthy = true
		status.Failures = 0
		status.LastHealthy = time.Now()
		status.Error = ""
	} else {
		status.Healthy = false
		status.Failures++
		status.Error = err.Error()

		log.Printf("❌ Service %s unhealthy (failure #%d): %v", service.Name, status.Failures, err)

		// Check if we should trigger recovery action
		if status.Failures >= hm.config.FailureThreshold {
			hm.handleServiceFailure(service, status)
		}

		// Send alert for critical services or after threshold
		if service.Critical || status.Failures >= hm.config.FailureThreshold {
			severity := "warning"
			if service.Critical {
				severity = "critical"
			}

			hm.alertChannel <- Alert{
				Type:      "failure",
				Service:   service.Name,
				Message:   fmt.Sprintf("Service failure #%d: %v", status.Failures, err),
				Timestamp: time.Now(),
				Severity:  severity,
			}
		}
	}

	hm.statusMutex.Unlock()
}

func (hm *HealthMonitor) checkHTTPHealth(service Service) (bool, error) {
	url := service.URL + service.HealthPath

	client := &http.Client{
		Timeout: time.Duration(service.Timeout) * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return true, nil
}

func (hm *HealthMonitor) handleServiceFailure(service Service, status *HealthStatus) {
	log.Printf("🔧 Handling service failure for %s (failures: %d)", service.Name, status.Failures)

	switch hm.config.RecoveryAction {
	case "restart":
		if service.ContainerID != "" && hm.dockerClient != nil {
			hm.restartContainer(service.ContainerID)
		} else {
			log.Printf("⚠️ Cannot restart service %s: no container ID or Docker client", service.Name)
		}
	case "alert":
		// Alert already sent above
	default:
		log.Printf("⚠️ Unknown recovery action: %s", hm.config.RecoveryAction)
	}
}

func (hm *HealthMonitor) restartContainer(containerID string) {
	if hm.dockerClient == nil {
		log.Printf("❌ Docker client not available for restart")
		return
	}

	ctx := context.Background()

	// Get container info
	info, err := hm.dockerClient.ContainerInspect(ctx, containerID)
	if err != nil {
		log.Printf("❌ Failed to inspect container %s: %v", containerID, err)
		return
	}

	// Stop container
	log.Printf("🛑 Stopping container %s", containerID)
	err = hm.dockerClient.ContainerStop(ctx, containerID, &containerID)
	if err != nil {
		log.Printf("❌ Failed to stop container %s: %v", containerID, err)
		return
	}

	// Start container
	log.Printf("🚀 Starting container %s", containerID)
	err = hm.dockerClient.ContainerStart(ctx, containerID, types.ContainerStartOptions{})
	if err != nil {
		log.Printf("❌ Failed to start container %s: %v", containerID, err)
		return
	}

	log.Printf("✅ Successfully restarted container %s", containerID)
}

func (hm *HealthMonitor) alertProcessor() {
	for alert := range hm.alertChannel {
		hm.sendAlert(alert)
	}
}

func (hm *HealthMonitor) sendAlert(alert Alert) {
	if hm.config.AlertWebhookURL == "" {
		return
	}

	payload := map[string]interface{}{
		"text": fmt.Sprintf("Health Monitor Alert: %s", alert.Message),
		"attachments": []map[string]interface{}{
			{
				"color": hm.getAlertColor(alert.Severity),
				"fields": []map[string]interface{}{
					{"title": "Service", "value": alert.Service, "short": true},
					{"title": "Type", "value": alert.Type, "short": true},
					{"title": "Severity", "value": alert.Severity, "short": true},
					{"title": "Message", "value": alert.Message, "short": false},
					{"title": "Timestamp", "value": alert.Timestamp.Format(time.RFC3339), "short": true},
				},
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		log.Printf("❌ Failed to marshal alert: %v", err)
		return
	}

	resp, err := http.Post(hm.config.AlertWebhookURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("❌ Failed to send alert: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("❌ Alert webhook returned status %d", resp.StatusCode)
	}
}

func (hm *HealthMonitor) getAlertColor(severity string) string {
	switch severity {
	case "critical":
		return "danger"
	case "warning":
		return "warning"
	default:
		return "good"
	}
}

func (hm *HealthMonitor) startHTTPServer() {
	http.HandleFunc("/health", hm.healthHandler)
	http.HandleFunc("/status", hm.statusHandler)
	http.HandleFunc("/services", hm.servicesHandler)

	log.Println("Starting HTTP server on port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func (hm *HealthMonitor) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"service":   "health-monitor",
	})
}

func (hm *HealthMonitor) statusHandler(w http.ResponseWriter, r *http.Request) {
	hm.statusMutex.RLock()
	defer hm.statusMutex.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(hm.statuses)
}

func (hm *HealthMonitor) servicesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(hm.config.Services)
}

// =============================================================================
// MAIN APPLICATION
// =============================================================================

func main() {
	// Load configuration
	config := loadConfig()

	// Create health monitor
	monitor, err := NewHealthMonitor(config)
	if err != nil {
		log.Fatalf("Failed to create health monitor: %v", err)
	}

	// Handle shutdown gracefully
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		log.Println("Shutting down health monitor...")
		os.Exit(0)
	}()

	// Start monitoring
	monitor.Start()
}

func loadConfig() *Config {
	// Default configuration
	config := &Config{
		CheckInterval:      getEnv("CHECK_INTERVAL", "30s"),
		FailureThreshold:   getEnvInt("FAILURE_THRESHOLD", 3),
		RecoveryAction:     getEnv("RECOVERY_ACTION", "restart"),
		HealthCheckTimeout: getEnv("HEALTH_CHECK_TIMEOUT", "10s"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		AlertWebhookURL:    getEnv("ALERT_WEBHOOK_URL", ""),
		DockerEnabled:      getEnvBool("DOCKER_ENABLED", true),
		Services: []Service{
			{
				Name:       "chat-service",
				URL:        "http://localhost:8010",
				HealthPath: "/health",
				Timeout:    5,
				Retries:    3,
				Critical:   true,
			},
			{
				Name:       "mlx-service",
				URL:        "http://localhost:8001",
				HealthPath: "/health",
				Timeout:    5,
				Retries:    3,
				Critical:   true,
			},
			{
				Name:       "hrm-service",
				URL:        "http://localhost:8002",
				HealthPath: "/health",
				Timeout:    5,
				Retries:    3,
				Critical:   false,
			},
			{
				Name:       "implementation-service",
				URL:        "http://localhost:8029",
				HealthPath: "/health",
				Timeout:    5,
				Retries:    3,
				Critical:   false,
			},
			{
				Name:       "research-service",
				URL:        "http://localhost:8028",
				HealthPath: "/health",
				Timeout:    5,
				Retries:    3,
				Critical:   false,
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

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
