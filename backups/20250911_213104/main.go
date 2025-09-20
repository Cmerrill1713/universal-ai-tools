package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"golang.org/x/time/rate"
)

// ServiceRegistry manages backend service endpoints
type ServiceRegistry struct {
	mu       sync.RWMutex
	services map[string]*ServiceEndpoint
}

// ServiceEndpoint represents a backend service
type ServiceEndpoint struct {
	Name        string
	URL         string
	HealthCheck string
	Healthy     bool
	LastCheck   time.Time
}

// RateLimiter manages API rate limiting
type RateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
}

var (
	registry      *ServiceRegistry
	rateLimiter   *RateLimiter
	upgrader      = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// Configure origin checking for production
			return true
		},
	}
)

func init() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Initialize service registry
	registry = &ServiceRegistry{
		services: make(map[string]*ServiceEndpoint),
	}

	// Initialize rate limiter
	rateLimiter = &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
	}

	// Initialize guardrails (placeholder for future implementation)
	// guardrails = NewGuardrailsManager()

	// Register services
	registerServices()
}

func registerServices() {
	// Register Go services
	registry.Register("ml-inference", getEnvOrDefault("ML_INFERENCE_URL", "http://localhost:8084"))
	registry.Register("load-balancer", getEnvOrDefault("LOAD_BALANCER_URL", "http://localhost:8011"))
	registry.Register("cache-coordinator", getEnvOrDefault("CACHE_COORDINATOR_URL", "http://localhost:8012"))
	registry.Register("metrics-aggregator", getEnvOrDefault("METRICS_AGGREGATOR_URL", "http://localhost:8013"))
	registry.RegisterWithHealthCheck("service-discovery", getEnvOrDefault("SERVICE_DISCOVERY_URL", "http://localhost:8094"), "http://localhost:8094/api/v1/discovery/health")
	registry.Register("auth-service", getEnvOrDefault("AUTH_SERVICE_URL", "http://localhost:8015"))
	registry.Register("chat-service", getEnvOrDefault("CHAT_SERVICE_URL", "http://localhost:8016"))
	registry.Register("memory-service", getEnvOrDefault("MEMORY_SERVICE_URL", "http://localhost:8017"))
	registry.Register("websocket-hub", getEnvOrDefault("WEBSOCKET_HUB_URL", "http://localhost:8018"))
	registry.Register("weaviate-client", getEnvOrDefault("WEAVIATE_CLIENT_URL", "http://localhost:8019"))

	// Register Rust services
	registry.Register("fast-llm", getEnvOrDefault("FAST_LLM_URL", "http://localhost:3031"))
	registry.Register("llm-router", getEnvOrDefault("LLM_ROUTER_URL", "http://localhost:3031"))
	registry.Register("parameter-analytics", getEnvOrDefault("PARAMETER_ANALYTICS_URL", "http://localhost:3032"))
	registry.Register("vision-service", getEnvOrDefault("VISION_SERVICE_URL", "http://localhost:3033"))

	// Vector Database Services
	registry.RegisterWithHealthCheck("weaviate", getEnvOrDefault("WEAVIATE_URL", "http://localhost:8090"), "http://localhost:8090/v1/meta")

	// Legacy TypeScript services (to be migrated)
	registry.Register("legacy-api", getEnvOrDefault("LEGACY_API_URL", "http://localhost:3001"))
}

func (sr *ServiceRegistry) Register(name, url string) {
	sr.RegisterWithHealthCheck(name, url, url+"/health")
}

func (sr *ServiceRegistry) RegisterWithHealthCheck(name, url, healthCheck string) {
	sr.mu.Lock()
	defer sr.mu.Unlock()

	sr.services[name] = &ServiceEndpoint{
		Name:        name,
		URL:         url,
		HealthCheck: healthCheck,
		Healthy:     true,
		LastCheck:   time.Now(),
	}
}

func (sr *ServiceRegistry) GetService(name string) (*ServiceEndpoint, bool) {
	sr.mu.RLock()
	defer sr.mu.RUnlock()

	service, exists := sr.services[name]
	return service, exists
}

func (rl *RateLimiter) GetLimiter(clientIP string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if limiter, exists := rl.limiters[clientIP]; exists {
		return limiter
	}

	// Create new limiter: 100 requests per second with burst of 200
	limiter := rate.NewLimiter(100, 200)
	rl.limiters[clientIP] = limiter
	return limiter
}

// Middleware functions
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Log request
		log.Printf("[%s] %s %s", r.Method, r.RequestURI, r.RemoteAddr)

		// Call next handler
		next.ServeHTTP(w, r)

		// Log response time
		log.Printf("Request completed in %v", time.Since(start))
	})
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientIP := getClientIP(r)
		limiter := rateLimiter.GetLimiter(clientIP)

		if !limiter.Allow() {
			http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for health check and public endpoints
		if strings.HasPrefix(r.URL.Path, "/health") ||
		   strings.HasPrefix(r.URL.Path, "/api/public") {
			next.ServeHTTP(w, r)
			return
		}

		// Check for API key or JWT token
		apiKey := r.Header.Get("X-API-Key")
		authHeader := r.Header.Get("Authorization")

		if apiKey == "" && authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// JWT validation enhancement planned for production security
		// Currently uses basic header presence check - full JWT validation pending

		next.ServeHTTP(w, r)
	})
}

// Route handlers
func healthHandler(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
		"services":  getServicesHealth(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func getServicesHealth() map[string]bool {
	registry.mu.RLock()
	defer registry.mu.RUnlock()

	health := make(map[string]bool)
	for name, service := range registry.services {
		health[name] = service.Healthy
	}
	return health
}

// Proxy handler for routing to microservices
func proxyHandler(serviceName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		service, exists := registry.GetService(serviceName)
		if !exists || !service.Healthy {
			http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
			return
		}

		targetURL, _ := url.Parse(service.URL)
		proxy := httputil.NewSingleHostReverseProxy(targetURL)

		// Modify the request
		r.URL.Host = targetURL.Host
		r.URL.Scheme = targetURL.Scheme
		r.Header.Set("X-Forwarded-Host", r.Header.Get("Host"))
		r.Host = targetURL.Host

		proxy.ServeHTTP(w, r)
	}
}

// WebSocket handler for real-time connections
func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Handle WebSocket messages
	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}

		// Echo message back for now
		if err := conn.WriteMessage(messageType, message); err != nil {
			log.Printf("WebSocket write error: %v", err)
			break
		}
	}
}

// Chat API handler (migrated from TypeScript)
func chatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Message  string `json:"message"`
		Model    string `json:"model"`
		Context  string `json:"context"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Route to appropriate LLM service
	if req.Model == "" {
		req.Model = "default"
	}

	// Forward to LLM router service
	service, exists := registry.GetService("llm-router")
	if !exists {
		http.Error(w, "LLM service unavailable", http.StatusServiceUnavailable)
		return
	}

	// Create proxy request
	proxyReq, _ := http.NewRequest("POST", service.URL+"/chat", r.Body)
	proxyReq.Header = r.Header

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(proxyReq)
	if err != nil {
		http.Error(w, "Service error", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	// Copy response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	httputil.DumpResponse(resp, true)
}

// Memory API handler
func memoryHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		// Retrieve memories
		memories := map[string]interface{}{
			"memories": []string{},
			"total":    0,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(memories)

	case http.MethodPost:
		// Store new memory
		var memory struct {
			Content string `json:"content"`
			Type    string `json:"type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&memory); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		response := map[string]interface{}{
			"success": true,
			"id":      generateID(),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return strings.Split(r.RemoteAddr, ":")[0]
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Health check goroutine
func healthCheckServices(ctx context.Context) {
	// Reduced interval from 30s to 10s for faster detection
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Initial health check on startup
	performHealthChecks()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			performHealthChecks()
		}
	}
}

func performHealthChecks() {
	registry.mu.Lock()
	services := make(map[string]*ServiceEndpoint)
	for name, service := range registry.services {
		services[name] = service
	}
	registry.mu.Unlock()

	for name, service := range services {
		go checkServiceHealth(name, service)
	}
}

func checkServiceHealth(name string, service *ServiceEndpoint) {
	client := &http.Client{Timeout: 3 * time.Second}

	// Retry logic: 3 attempts with exponential backoff
	var lastErr error
	var resp *http.Response

	for attempt := 1; attempt <= 3; attempt++ {
		resp, lastErr = client.Get(service.HealthCheck)
		if lastErr == nil && resp.StatusCode == http.StatusOK {
			break
		}

		if attempt < 3 {
			// Exponential backoff: 1s, 2s, 4s
			time.Sleep(time.Duration(attempt) * time.Second)
		}
	}

	registry.mu.Lock()
	defer registry.mu.Unlock()

	if lastErr != nil || resp == nil || resp.StatusCode != http.StatusOK {
		if service.Healthy {
			log.Printf("Service %s became unhealthy: %v", name, lastErr)
		}
		service.Healthy = false
	} else {
		if !service.Healthy {
			log.Printf("Service %s became healthy", name)
		}
		service.Healthy = true
	}
	service.LastCheck = time.Now()

	if resp != nil {
		resp.Body.Close()
	}
}

func main() {
	// Create router
	router := mux.NewRouter()

	// Apply global middleware
	router.Use(loggingMiddleware)
	router.Use(rateLimitMiddleware)
	// router.Use(guardrails.GuardrailsMiddleware) // Placeholder for future implementation

	// Public endpoints
	router.HandleFunc("/health", healthHandler).Methods("GET")
	// router.HandleFunc("/guardrails/metrics", guardrails.GuardrailsMetricsHandler).Methods("GET") // Placeholder
	router.HandleFunc("/ws", wsHandler)

	// Manual health check refresh endpoint
	router.HandleFunc("/health/refresh", func(w http.ResponseWriter, r *http.Request) {
		performHealthChecks()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Health checks triggered",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}).Methods("POST")

	// API routes with auth
	api := router.PathPrefix("/api").Subrouter()
	api.Use(authMiddleware)

	// Core API endpoints
	api.HandleFunc("/chat", chatHandler).Methods("POST")
	api.HandleFunc("/memory", memoryHandler).Methods("GET", "POST")

	// Authentication routes
	api.HandleFunc("/auth/{path:.*}", proxyHandler("auth-service")).Methods("GET", "POST", "PUT", "DELETE")

	// Chat service routes
	api.HandleFunc("/conversations/{path:.*}", proxyHandler("chat-service")).Methods("GET", "POST", "DELETE")

	// Memory service routes
	api.HandleFunc("/memories/{path:.*}", proxyHandler("memory-service")).Methods("GET", "POST", "PUT", "DELETE")
	api.HandleFunc("/context/{path:.*}", proxyHandler("memory-service")).Methods("GET", "POST")

	// Vision service routes
	api.HandleFunc("/vision/{path:.*}", proxyHandler("vision-service")).Methods("GET", "POST", "DELETE")

	// Weaviate vector database routes
	api.HandleFunc("/vectors/{path:.*}", proxyHandler("weaviate-client")).Methods("GET", "POST", "DELETE")
	api.HandleFunc("/embed/{path:.*}", proxyHandler("weaviate-client")).Methods("POST")
	api.HandleFunc("/documents/{path:.*}", proxyHandler("weaviate-client")).Methods("GET", "POST", "PUT", "DELETE")
	api.HandleFunc("/search/{path:.*}", proxyHandler("weaviate-client")).Methods("POST")

	// ML service routes
	api.HandleFunc("/ml/{path:.*}", proxyHandler("ml-inference")).Methods("GET", "POST")
	api.HandleFunc("/llm/{path:.*}", proxyHandler("llm-router")).Methods("GET", "POST")
	api.HandleFunc("/analytics/{path:.*}", proxyHandler("parameter-analytics")).Methods("GET", "POST")

	// Metrics and monitoring
	api.HandleFunc("/metrics/{path:.*}", proxyHandler("metrics-aggregator")).Methods("GET")

	// Service discovery
	api.HandleFunc("/services/{path:.*}", proxyHandler("service-discovery")).Methods("GET", "POST")

	// Legacy fallback (temporary during migration)
	api.PathPrefix("/legacy/").HandlerFunc(proxyHandler("legacy-api"))

	// Configure CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   strings.Split(getEnvOrDefault("CORS_ORIGINS", "*"), ","),
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(router)

	// Start health check routine
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go healthCheckServices(ctx)

	// Start server
	port := getEnvOrDefault("PORT", "8080")
	log.Printf("API Gateway starting on port %s", port)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
