package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
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
}

type Service struct {
	Name       string `json:"name"`
	URL        string `json:"url"`
	HealthPath string `json:"health_path"`
	Timeout    int    `json:"timeout"`
	Retries    int    `json:"retries"`
	Critical   bool   `json:"critical"`
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
	statuses     map[string]*HealthStatus
	statusMutex  sync.RWMutex
	httpClient   *http.Client
	alertChannel chan Alert
}

func NewHealthMonitor(config *Config) *HealthMonitor {
	timeout, err := time.ParseDuration(config.HealthCheckTimeout)
	if err != nil {
		timeout = 10 * time.Second
	}

	hm := &HealthMonitor{
		config:   config,
		statuses: make(map[string]*HealthStatus),
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

	return hm
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
	monitor := NewHealthMonitor(config)

	// Start monitoring
	monitor.Start()
}

func loadConfig() *Config {
	// Default configuration
	config := &Config{
		CheckInterval:      getEnv("CHECK_INTERVAL", "30s"),
		FailureThreshold:   getEnvInt("FAILURE_THRESHOLD", 3),
		RecoveryAction:     getEnv("RECOVERY_ACTION", "alert"),
		HealthCheckTimeout: getEnv("HEALTH_CHECK_TIMEOUT", "10s"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		AlertWebhookURL:    getEnv("ALERT_WEBHOOK_URL", ""),
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
