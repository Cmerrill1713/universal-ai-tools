package main

import (
    "bytes"
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
)

// ServiceRegistry holds information about available services
type ServiceRegistry struct {
	ChatService        string `json:"chat_service"`
	MemoryService      string `json:"memory_service"`
	LLMRouter          string `json:"llm_router"`
	VisionService      string `json:"vision_service"`
	MLXService         string `json:"mlx_service"`
	WebSocketHub       string `json:"websocket_hub"`
	ParameterAnalytics string `json:"parameter_analytics"`
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Service   string                 `json:"service"`
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Services  map[string]interface{} `json:"services"`
}

// ProxyConfig holds proxy configuration for services
type ProxyConfig struct {
	Target string
	Proxy  *httputil.ReverseProxy
}

var (
    serviceRegistry = ServiceRegistry{
		ChatService:        "http://localhost:8016",
		MemoryService:      "http://localhost:8017",
		LLMRouter:          "http://localhost:3033",
		VisionService:      "http://localhost:8084",
		MLXService:         "http://localhost:8001",
		WebSocketHub:       "http://localhost:8082",
		ParameterAnalytics: "http://localhost:8019",
	}

    proxies  = make(map[string]*ProxyConfig)
    upgrader = websocket.Upgrader{
        CheckOrigin: func(r *http.Request) bool {
            return true // Allow all origins for development
        },
    }
    assistantStreamRP   *httputil.ReverseProxy
    assistantStreamOnce sync.Once
)

func init() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Allow env overrides for service endpoints
	serviceRegistry.ChatService = getEnvOrDefault("CHAT_SERVICE_URL", serviceRegistry.ChatService)
	serviceRegistry.MemoryService = getEnvOrDefault("MEMORY_SERVICE_URL", serviceRegistry.MemoryService)
	serviceRegistry.LLMRouter = getEnvOrDefault("LLM_ROUTER_URL", serviceRegistry.LLMRouter)
	serviceRegistry.VisionService = getEnvOrDefault("VISION_SERVICE_URL", serviceRegistry.VisionService)
	serviceRegistry.MLXService = getEnvOrDefault("MLX_SERVICE_URL", serviceRegistry.MLXService)
	serviceRegistry.WebSocketHub = getEnvOrDefault("WEBSOCKET_HUB_URL", serviceRegistry.WebSocketHub)
	serviceRegistry.ParameterAnalytics = getEnvOrDefault("PARAMETER_ANALYTICS_URL", serviceRegistry.ParameterAnalytics)

    // Initialize proxies for each service
    initProxies()
}

func initProxies() {
    services := map[string]string{
        "chat":       getEnvOrDefault("CHAT_SERVICE_URL", serviceRegistry.ChatService),
        "memory":     getEnvOrDefault("MEMORY_SERVICE_URL", serviceRegistry.MemoryService),
        "llm":        getEnvOrDefault("LLM_ROUTER_URL", serviceRegistry.LLMRouter),
        "vision":     getEnvOrDefault("VISION_SERVICE_URL", serviceRegistry.VisionService),
        "mlx":        getEnvOrDefault("MLX_SERVICE_URL", serviceRegistry.MLXService),
        "websocket":  getEnvOrDefault("WEBSOCKET_HUB_URL", serviceRegistry.WebSocketHub),
        "analytics":  getEnvOrDefault("PARAMETER_ANALYTICS_URL", serviceRegistry.ParameterAnalytics),
        "assistantd": getEnvOrDefault("ASSISTANTD_URL", os.Getenv("ASSISTANTD_URL")),
        "knowledge":  getEnvOrDefault("KNOWLEDGE_GATEWAY_URL", "http://localhost:8088"),
        "kcontext":   getEnvOrDefault("KNOWLEDGE_CONTEXT_URL", "http://localhost:8083"),
    }

	for name, target := range services {
		targetURL, err := url.Parse(target)
		if err != nil {
			log.Printf("Error parsing target URL for %s: %v", name, err)
			continue
		}

		proxy := httputil.NewSingleHostReverseProxy(targetURL)
		proxies[name] = &ProxyConfig{
			Target: target,
			Proxy:  proxy,
		}
		log.Printf("Initialized proxy for %s -> %s", name, target)
	}
}

// Health check endpoint
func healthHandler(w http.ResponseWriter, r *http.Request) {
	services := make(map[string]interface{})

	// Check each service health
	for name, config := range proxies {
		health := checkServiceHealth(config.Target)
		services[name] = map[string]interface{}{
			"url":    config.Target,
			"status": health,
		}
	}

	response := HealthResponse{
		Service:   "api-gateway",
		Status:    "healthy",
		Timestamp: time.Now(),
		Services:  services,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func checkServiceHealth(targetURL string) string {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(targetURL + "/health")
	if err != nil {
		return "unhealthy"
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return "healthy"
	}
	return "unhealthy"
}

// Proxy handler for routing requests to services
func proxyHandler(serviceName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		config, exists := proxies[serviceName]
		if !exists {
			http.Error(w, fmt.Sprintf("Service %s not found", serviceName), http.StatusNotFound)
			return
		}

		// Add CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Add user ID header if not present
		if r.Header.Get("X-User-ID") == "" {
			r.Header.Set("X-User-ID", "api-gateway-user")
		}

		// Proxy the request
		config.Proxy.ServeHTTP(w, r)
	}
}

// Assistant chat handler (Rust assistantd)
func assistantChatHandler(w http.ResponseWriter, r *http.Request) {
    // CORS headers
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID")
    if r.Method == "OPTIONS" {
        w.WriteHeader(http.StatusOK)
        return
    }
	assistantURL := os.Getenv("ASSISTANTD_URL")
	if assistantURL == "" {
		assistantURL = getEnvOrDefault("CHAT_SERVICE_URL", serviceRegistry.ChatService)
	}
	target := strings.TrimRight(assistantURL, "/") + "/chat"

	// Read incoming body
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Forward to assistantd
	req, err := http.NewRequest("POST", target, bytes.NewReader(bodyBytes))
	if err != nil {
		http.Error(w, "failed to build upstream request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("assistantd unreachable: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// WebSocket proxy handler
func wsProxyHandler(w http.ResponseWriter, r *http.Request) {
	// Connect to the WebSocket hub
	wsURL := strings.Replace(serviceRegistry.WebSocketHub, "http", "ws", 1) + "/ws/chat"

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Connect to the target WebSocket service
	targetConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		log.Printf("Failed to connect to WebSocket hub: %v", err)
		return
	}
	defer targetConn.Close()

	// Proxy messages between connections
	go func() {
		for {
			messageType, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("Error reading from client: %v", err)
				return
			}

			if err := targetConn.WriteMessage(messageType, message); err != nil {
				log.Printf("Error writing to target: %v", err)
				return
			}
		}
	}()

	for {
		messageType, message, err := targetConn.ReadMessage()
		if err != nil {
			log.Printf("Error reading from target: %v", err)
			return
		}

		if err := conn.WriteMessage(messageType, message); err != nil {
			log.Printf("Error writing to client: %v", err)
			return
		}
	}
}

// Unified chat endpoint that routes to the Go chat service
func chatHandler(w http.ResponseWriter, r *http.Request) {
	// Add user ID header if not present
	if r.Header.Get("X-User-ID") == "" {
		r.Header.Set("X-User-ID", "api-gateway-user")
	}

	// Route to chat service
	proxyHandler("chat")(w, r)
}

// Assistant streaming (SSE) passthrough -> assistantd /chat/stream
func assistantStreamHandler(w http.ResponseWriter, r *http.Request) {
    // CORS headers
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID")
    if r.Method == "OPTIONS" {
        w.WriteHeader(http.StatusOK)
        return
    }
    assistantStreamOnce.Do(func() {
        base := os.Getenv("ASSISTANTD_URL")
        if base == "" {
            base = getEnvOrDefault("CHAT_SERVICE_URL", serviceRegistry.ChatService)
        }
        targetURL, err := url.Parse(base)
        if err != nil {
            log.Printf("assistant stream proxy url parse error: %v", err)
            return
        }
        rp := httputil.NewSingleHostReverseProxy(targetURL)
        director := rp.Director
        rp.Director = func(req *http.Request) {
            director(req)
            req.URL.Path = "/chat/stream"
            req.Host = targetURL.Host
        }
        rp.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, err error) {
            http.Error(rw, fmt.Sprintf("assistantd stream error: %v", err), http.StatusBadGateway)
        }
        rp.FlushInterval = 100 * time.Millisecond
        assistantStreamRP = rp
    })
    if assistantStreamRP == nil {
        http.Error(w, "assistant stream proxy not initialized", http.StatusServiceUnavailable)
        return
    }
    // Forward request; ReverseProxy will stream and flush periodically
    assistantStreamRP.ServeHTTP(w, r)
}

// Models endpoint that aggregates models from all services
func modelsHandler(w http.ResponseWriter, r *http.Request) {
	models := make(map[string]interface{})

	// Get models from LLM Router
	llmModels := getModelsFromService(serviceRegistry.LLMRouter + "/models")
	if llmModels != nil {
		models["llm_router"] = llmModels
	}

	// Get models from MLX Service
	mlxModels := getModelsFromService(serviceRegistry.MLXService + "/models")
	if mlxModels != nil {
		models["mlx"] = mlxModels
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"models":         models,
			"total_services": len(models),
		},
		"metadata": map[string]interface{}{
			"timestamp": time.Now().Format(time.RFC3339),
			"service":   "api-gateway",
		},
	})
}

func getModelsFromService(url string) interface{} {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil
	}

	return result
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
    router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.HandleFunc("/api/health", healthHandler).Methods("GET")

    // Unified API endpoints
    router.HandleFunc("/api/v1/chat", chatHandler).Methods("POST")
    router.HandleFunc("/api/v1/assistant/chat", assistantChatHandler).Methods("POST")
    router.HandleFunc("/api/v1/assistant/stream", assistantStreamHandler).Methods("POST")
    router.HandleFunc("/api/v1/models", modelsHandler).Methods("GET")
    router.HandleFunc("/api/v1/ws", wsProxyHandler)

    // Service-specific proxy endpoints
    router.PathPrefix("/api/v1/chat/").HandlerFunc(proxyHandler("chat"))
    router.PathPrefix("/api/v1/memory/").HandlerFunc(proxyHandler("memory"))
    router.PathPrefix("/api/v1/llm/").HandlerFunc(proxyHandler("llm"))
    router.PathPrefix("/api/v1/vision/").HandlerFunc(proxyHandler("vision"))
    router.PathPrefix("/api/v1/mlx/").HandlerFunc(proxyHandler("mlx"))
    router.PathPrefix("/api/v1/analytics/").HandlerFunc(proxyHandler("analytics"))
    router.PathPrefix("/api/v1/assistant/").HandlerFunc(proxyHandler("assistantd"))
    router.PathPrefix("/api/v1/knowledge/").HandlerFunc(proxyHandler("knowledge"))
    router.PathPrefix("/api/v1/context/").HandlerFunc(proxyHandler("kcontext"))

	// WebSocket endpoints
	router.HandleFunc("/ws", wsProxyHandler)
	router.HandleFunc("/ws/chat", wsProxyHandler)

	// Root endpoint
	router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service":  "Universal AI Tools API Gateway",
			"version":  "1.0.0",
			"status":   "running",
			"services": serviceRegistry,
			"endpoints": map[string]interface{}{
				"health":    "/health",
				"chat":      "/api/v1/chat",
				"models":    "/api/v1/models",
				"websocket": "/ws",
			},
		})
	}).Methods("GET")

	// Start server
	port := getEnvOrDefault("API_GATEWAY_PORT", "9999")
	log.Printf("API Gateway starting on port %s", port)
	log.Printf("Available services:")
	for name, config := range proxies {
		log.Printf("  %s -> %s", name, config.Target)
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
