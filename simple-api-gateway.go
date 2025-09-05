package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/gorilla/mux"
)

type ServiceRoute struct {
	Path    string
	Target  *url.URL
	Healthy bool
}

var services = map[string]*ServiceRoute{
	// Core services
	"auth":      {Path: "/api/auth", Target: mustParseURL("http://localhost:8015"), Healthy: false},
	"chat":      {Path: "/api/chat", Target: mustParseURL("http://localhost:8016"), Healthy: false},
	"memory":    {Path: "/api/memory", Target: mustParseURL("http://localhost:8017"), Healthy: false},
	"websocket": {Path: "/ws", Target: mustParseURL("http://localhost:8018"), Healthy: false},
	
	// AI Services
	"llm":       {Path: "/api/llm", Target: mustParseURL("http://localhost:3033"), Healthy: false},
	"vision":    {Path: "/api/vision", Target: mustParseURL("http://localhost:3033"), Healthy: false},
	"speech":    {Path: "/api/speech", Target: mustParseURL("http://localhost:3033"), Healthy: false},
	"assistant": {Path: "/api/assistant", Target: mustParseURL("http://localhost:3033"), Healthy: false},
	
	// Data services
	"vectors":   {Path: "/api/vectors", Target: mustParseURL("http://localhost:8019"), Healthy: false},
	"context":   {Path: "/api/context", Target: mustParseURL("http://localhost:8017"), Healthy: false},
	"analytics": {Path: "/api/analytics", Target: mustParseURL("http://localhost:8020"), Healthy: false},
	
	// Infrastructure
	"health":    {Path: "/health", Target: mustParseURL("http://localhost:3033"), Healthy: false},
	"metrics":   {Path: "/metrics", Target: mustParseURL("http://localhost:8020"), Healthy: false},
	"monitoring": {Path: "/api/monitoring", Target: mustParseURL("http://localhost:8020"), Healthy: false},
}

func mustParseURL(rawURL string) *url.URL {
	u, err := url.Parse(rawURL)
	if err != nil {
		panic(err)
	}
	return u
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
		"services":  make(map[string]bool),
	}
	
	for name, service := range services {
		// Simple health check
		resp, err := http.Get(service.Target.String() + "/health")
		if err == nil && resp.StatusCode == 200 {
			service.Healthy = true
			status["services"].(map[string]bool)[name] = true
			resp.Body.Close()
		} else {
			service.Healthy = false
			status["services"].(map[string]bool)[name] = false
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func proxyHandler(service *ServiceRoute) http.HandlerFunc {
	proxy := httputil.NewSingleHostReverseProxy(service.Target)
	
	return func(w http.ResponseWriter, r *http.Request) {
		if !service.Healthy {
			http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
			return
		}
		
		// Remove the service path prefix
		r.URL.Path = r.URL.Path[len(service.Path):]
		if r.URL.Path == "" {
			r.URL.Path = "/"
		}
		
		proxy.ServeHTTP(w, r)
	}
}

func main() {
	r := mux.NewRouter()
	
	// Add CORS middleware
	r.Use(corsMiddleware)
	
	// Health endpoint
	r.HandleFunc("/health", healthCheck).Methods("GET")
	
	// Service routes
	for _, service := range services {
		r.PathPrefix(service.Path).HandlerFunc(proxyHandler(service))
	}
	
	// Default route
	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "Universal AI Tools API Gateway",
			"version": "1.0.0",
			"status":  "running",
		})
	}).Methods("GET")
	
	fmt.Println("API Gateway starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}