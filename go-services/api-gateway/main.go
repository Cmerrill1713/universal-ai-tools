package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	registry       *ServiceRegistry
	rateLimiter    *RateLimiter
	secretsManager *SecretsManager
	upgrader       = websocket.Upgrader{
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

	// Initialize secrets manager
	secretsManager = NewSecretsManager()

	// Initialize secrets in Supabase Vault
	if err := secretsManager.InitializeSecrets(); err != nil {
		log.Printf("Warning: Failed to initialize secrets: %v", err)
	}

	// Initialize guardrails (placeholder for future implementation)
	// guardrails = NewGuardrailsManager()

	// Register services
	registerServices()
}

func registerServices() {
	// Register Go services
	registry.Register("ml-inference", getEnvOrDefault("ML_INFERENCE_URL", "http://localhost:8091"))
	registry.Register("load-balancer", getEnvOrDefault("LOAD_BALANCER_URL", "http://localhost:8011"))
	registry.Register("cache-coordinator", getEnvOrDefault("CACHE_COORDINATOR_URL", "http://localhost:8012"))
	registry.Register("metrics-aggregator", getEnvOrDefault("METRICS_AGGREGATOR_URL", "http://localhost:8013"))
	registry.RegisterWithHealthCheck("service-discovery", getEnvOrDefault("SERVICE_DISCOVERY_URL", "http://localhost:8094"), "http://localhost:8094/api/v1/discovery/health")
	// Swift Auth Service (Primary)
	registry.Register("swift-auth", getEnvOrDefault("SWIFT_AUTH_URL", "http://localhost:8016"))
	// Go Auth Service (Legacy Fallback)
	registry.Register("auth-service-legacy", getEnvOrDefault("AUTH_SERVICE_URL", "http://localhost:8015"))
	registry.Register("chat-service", getEnvOrDefault("CHAT_SERVICE_URL", "http://localhost:8016"))
	registry.Register("memory-service", getEnvOrDefault("MEMORY_SERVICE_URL", "http://localhost:8016"))
	registry.Register("websocket-hub", getEnvOrDefault("WEBSOCKET_HUB_URL", "http://localhost:8018"))
	registry.Register("weaviate-client", getEnvOrDefault("WEAVIATE_CLIENT_URL", "http://localhost:8020"))

	// Register Rust services
	registry.Register("fast-llm", getEnvOrDefault("FAST_LLM_URL", "http://localhost:3031"))
	registry.Register("llm-router", getEnvOrDefault("LLM_ROUTER_URL", "http://localhost:3032"))
	registry.Register("parameter-analytics", getEnvOrDefault("PARAMETER_ANALYTICS_URL", "http://localhost:3032"))
	registry.Register("vision-service", getEnvOrDefault("VISION_SERVICE_URL", "http://localhost:8084"))

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

		// Check for API key, JWT token, or User ID
		apiKey := r.Header.Get("X-API-Key")
		authHeader := r.Header.Get("Authorization")
		userID := r.Header.Get("X-User-ID")

		if apiKey == "" && authHeader == "" && userID == "" {
			http.Error(w, "Unauthorized: Missing authentication", http.StatusUnauthorized)
			return
		}

		// Validate API key against Supabase Vault
		if apiKey != "" {
			if !validateAPIKey(apiKey) {
				http.Error(w, "Unauthorized: Invalid API key", http.StatusUnauthorized)
				return
			}
		}

		// Validate JWT token
		if authHeader != "" {
			if !validateJWTToken(authHeader) {
				http.Error(w, "Unauthorized: Invalid JWT token", http.StatusUnauthorized)
				return
			}
		}

		// Add user context to request
		if userID != "" {
			r.Header.Set("X-Authenticated-User", userID)
		}

		next.ServeHTTP(w, r)
	})
}

// validateAPIKey checks API key against Supabase Vault
func validateAPIKey(apiKey string) bool {
	return secretsManager.ValidateAPIKey(apiKey)
}

// validateJWTToken validates JWT token signature and claims
func validateJWTToken(authHeader string) bool {
	// Extract token from "Bearer <token>" format
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return false
	}

	token := parts[1]

	// SECURITY: Implement proper JWT validation
	// For now, reject all tokens until proper validation is implemented
	if len(token) > 10 {
		log.Printf("SECURITY WARNING: JWT validation not implemented - rejecting token: %s...", token[:10])
	} else {
		log.Printf("SECURITY WARNING: JWT validation not implemented - rejecting token: %s", token)
	}
	return false // SECURITY: Reject all JWT tokens until proper validation
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

// Swift Auth handler with Go Auth fallback
func swiftAuthHandler(w http.ResponseWriter, r *http.Request) {
	// Try Swift Auth first (primary)
	swiftService, swiftExists := registry.GetService("swift-auth")
	if swiftExists && swiftService.Healthy {
		log.Printf("Routing auth request to Swift Auth: %s %s", r.Method, r.URL.Path)
		log.Printf("Swift Auth Service URL: %s", swiftService.URL)

		// Create reverse proxy to Swift Auth
		targetURL, err := url.Parse(swiftService.URL)
		if err != nil {
			log.Printf("Error parsing Swift Auth URL: %v", err)
			http.Error(w, "Service configuration error", http.StatusInternalServerError)
			return
		}
		proxy := httputil.NewSingleHostReverseProxy(targetURL)

		// Update request path to match Swift auth service expectations
		// Strip /api/auth prefix and ensure /auth prefix
		originalPath := r.URL.Path
		path := strings.TrimPrefix(r.URL.Path, "/api/auth")
		if path == "" || path == "/" {
			path = "/health"
		} else if !strings.HasPrefix(path, "/auth") {
			path = "/auth" + path
		}
		log.Printf("Path transformation: %s -> %s", originalPath, path)
		log.Printf("Target URL: %s, Final path: %s", targetURL.String(), path)
		r.URL.Path = path

		// Update request headers
		r.URL.Host = targetURL.Host
		r.URL.Scheme = targetURL.Scheme
		r.Header.Set("X-Forwarded-Host", r.Header.Get("Host"))
		r.Header.Set("X-Auth-Source", "swift-primary")
		r.Host = targetURL.Host

		proxy.ServeHTTP(w, r)
		return
	}

	// Fallback to Go Auth (legacy)
	goService, goExists := registry.GetService("auth-service-legacy")
	if goExists && goService.Healthy {
		log.Printf("Swift Auth unavailable, routing to Go Auth (legacy): %s %s", r.Method, r.URL.Path)

		// Create reverse proxy to Go Auth
		targetURL, _ := url.Parse(goService.URL)
		proxy := httputil.NewSingleHostReverseProxy(targetURL)

		// Update request headers
		r.URL.Host = targetURL.Host
		r.URL.Scheme = targetURL.Scheme
		r.Header.Set("X-Forwarded-Host", r.Header.Get("Host"))
		r.Header.Set("X-Auth-Source", "go-legacy")
		r.Host = targetURL.Host

		proxy.ServeHTTP(w, r)
		return
	}

	// Both auth services unavailable
	log.Printf("Both Swift Auth and Go Auth services unavailable")
	http.Error(w, "Authentication service unavailable", http.StatusServiceUnavailable)
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

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode)

	// Copy response body
	io.Copy(w, resp.Body)
	if err != nil {
		http.Error(w, "Response error", http.StatusInternalServerError)
		return
	}
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
			"message":   "Health checks triggered",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}).Methods("POST")

	// API routes - register directly on main router for testing (NO AUTH MIDDLEWARE)
	router.HandleFunc("/api/test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "API Gateway routing working",
			"path":    r.URL.Path,
			"method":  r.Method,
		})
	}).Methods("GET")

	// Authentication routes - Swift Auth Primary, Go Auth Fallback (NO AUTH MIDDLEWARE)
	router.PathPrefix("/api/auth/").HandlerFunc(swiftAuthHandler)

	// Core API endpoints
	router.Handle("/api/chat", authMiddleware(http.HandlerFunc(chatHandler))).Methods("POST")
	router.Handle("/api/memory", authMiddleware(http.HandlerFunc(memoryHandler))).Methods("GET", "POST")

	// Chat service routes
	router.Handle("/api/conversations/{path:.*}", authMiddleware(proxyHandler("chat-service"))).Methods("GET", "POST", "DELETE")

	// Memory service routes
	router.Handle("/api/memories/{path:.*}", authMiddleware(proxyHandler("memory-service"))).Methods("GET", "POST", "PUT", "DELETE")
	router.Handle("/api/context/{path:.*}", authMiddleware(proxyHandler("memory-service"))).Methods("GET", "POST")

	// Vision service routes
	router.Handle("/api/vision/{path:.*}", authMiddleware(proxyHandler("vision-service"))).Methods("GET", "POST", "DELETE")

	// Weaviate vector database routes
	router.Handle("/api/vectors/{path:.*}", authMiddleware(proxyHandler("weaviate-client"))).Methods("GET", "POST", "DELETE")
	router.Handle("/api/embed/{path:.*}", authMiddleware(proxyHandler("weaviate-client"))).Methods("POST")
	router.Handle("/api/documents/{path:.*}", authMiddleware(proxyHandler("weaviate-client"))).Methods("GET", "POST", "PUT", "DELETE")
	router.Handle("/api/search/{path:.*}", authMiddleware(proxyHandler("weaviate-client"))).Methods("POST")

	// ML service routes
	router.Handle("/api/ml/{path:.*}", authMiddleware(proxyHandler("ml-inference"))).Methods("GET", "POST")
	router.Handle("/api/llm/{path:.*}", authMiddleware(proxyHandler("llm-router"))).Methods("GET", "POST")
	router.Handle("/api/analytics/{path:.*}", authMiddleware(proxyHandler("parameter-analytics"))).Methods("GET", "POST")

	// Metrics and monitoring
	router.Handle("/api/metrics/{path:.*}", authMiddleware(proxyHandler("metrics-aggregator"))).Methods("GET")

	// Service discovery
	router.Handle("/api/services/{path:.*}", authMiddleware(proxyHandler("service-discovery"))).Methods("GET", "POST")

	// Legacy fallback (temporary during migration)
	router.PathPrefix("/api/legacy/").Handler(authMiddleware(proxyHandler("legacy-api")))

	// Test route on main router
	router.HandleFunc("/api-test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Main router test route working",
			"path":    r.URL.Path,
			"method":  r.Method,
		})
	}).Methods("GET")

	// Configure CORS
	// c := cors.New(cors.Options{
	// 	AllowedOrigins:   strings.Split(getEnvOrDefault("CORS_ORIGINS", "*"), ","),
	// 	AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
	// 	AllowedHeaders:   []string{"*"},
	// 	AllowCredentials: true,
	// })

	// Temporarily disable CORS for testing
	// handler := c.Handler(router)
	handler := router

	// Start health check routine
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go healthCheckServices(ctx)

	// Start server
	port := getEnvOrDefault("PORT", "8081")
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
