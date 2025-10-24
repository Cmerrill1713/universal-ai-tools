package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// GuardrailsManager provides comprehensive safety mechanisms
type GuardrailsManager struct {
	rateLimiters    map[string]*rate.Limiter
	rateLimitMutex  sync.RWMutex
	circuitBreakers map[string]*CircuitBreaker
	circuitMutex    sync.RWMutex
	concurrentLimit int
	currentRequests int
	requestMutex    sync.Mutex
	validationRules *ValidationRules
}

// CircuitBreakerState represents the state of a circuit breaker
type CircuitBreakerState int

const (
	CircuitClosed CircuitBreakerState = iota
	CircuitOpen
	CircuitHalfOpen
)

// CircuitBreaker implements circuit breaker pattern
type CircuitBreaker struct {
	State           CircuitBreakerState
	FailureCount    int
	SuccessCount    int
	FailureThreshold int
	SuccessThreshold int
	Timeout         time.Duration
	LastFailure     time.Time
	Mutex           sync.Mutex
}

// ValidationRules defines input validation rules
type ValidationRules struct {
	MaxRequestSize      int64
	MaxURLLength        int
	MaxHeaderCount      int
	MaxHeaderValueSize  int
	AllowedMethods      []string
	BlockedPatterns     []*regexp.Regexp
	MaxConcurrentReqs   int
	RequestTimeout      time.Duration
}

// GuardrailsMetrics provides system metrics
type GuardrailsMetrics struct {
	CurrentConcurrentRequests int                    `json:"current_concurrent_requests"`
	MaxConcurrentRequests     int                    `json:"max_concurrent_requests"`
	ActiveRateLimiters        int                    `json:"active_rate_limiters"`
	ActiveCircuitBreakers     int                    `json:"active_circuit_breakers"`
	CircuitBreakerStates      map[string]string      `json:"circuit_breaker_states"`
	Timestamp                 int64                  `json:"timestamp"`
}

// NewGuardrailsManager creates a new guardrails manager
func NewGuardrailsManager() *GuardrailsManager {
	return &GuardrailsManager{
		rateLimiters:    make(map[string]*rate.Limiter),
		circuitBreakers: make(map[string]*CircuitBreaker),
		concurrentLimit: 1000,
		validationRules: &ValidationRules{
			MaxRequestSize:     10 * 1024 * 1024, // 10MB
			MaxURLLength:       2048,
			MaxHeaderCount:     50,
			MaxHeaderValueSize: 8192,
			AllowedMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
			BlockedPatterns: []*regexp.Regexp{
				regexp.MustCompile(`(?i)(script|javascript|vbscript|onload|onerror)`),
				regexp.MustCompile(`(?i)(union|select|insert|update|delete|drop|create|alter)`),
				regexp.MustCompile(`(?i)(<|>|&lt;|&gt;|&amp;|&quot;|&#x)`),
			},
			MaxConcurrentReqs: 1000,
			RequestTimeout:    30 * time.Second,
		},
	}
}

// CheckRateLimit verifies if a client can make a request
func (gm *GuardrailsManager) CheckRateLimit(clientID string) bool {
	gm.rateLimitMutex.Lock()
	defer gm.rateLimitMutex.Unlock()

	limiter, exists := gm.rateLimiters[clientID]
	if !exists {
		// Create new rate limiter: 100 requests per minute with burst of 20
		limiter = rate.NewLimiter(rate.Every(time.Minute/100), 20)
		gm.rateLimiters[clientID] = limiter
	}

	return limiter.Allow()
}

// ValidateRequest performs comprehensive request validation
func (gm *GuardrailsManager) ValidateRequest(r *http.Request) error {
	// Check request size
	if r.ContentLength > gm.validationRules.MaxRequestSize {
		return fmt.Errorf("request too large: %d bytes", r.ContentLength)
	}

	// Check URL length
	if len(r.URL.String()) > gm.validationRules.MaxURLLength {
		return fmt.Errorf("URL too long: %d characters", len(r.URL.String()))
	}

	// Check method
	validMethod := false
	for _, method := range gm.validationRules.AllowedMethods {
		if r.Method == method {
			validMethod = true
			break
		}
	}
	if !validMethod {
		return fmt.Errorf("method not allowed: %s", r.Method)
	}

	// Check header count
	if len(r.Header) > gm.validationRules.MaxHeaderCount {
		return fmt.Errorf("too many headers: %d", len(r.Header))
	}

	// Check header values
	for name, values := range r.Header {
		for _, value := range values {
			if len(value) > gm.validationRules.MaxHeaderValueSize {
				return fmt.Errorf("header value too long: %s", name)
			}
			// Check for blocked patterns
			for _, pattern := range gm.validationRules.BlockedPatterns {
				if pattern.MatchString(value) {
					return fmt.Errorf("blocked pattern in header %s: %s", name, value)
				}
			}
		}
	}

	// Check query parameters
	for key, values := range r.URL.Query() {
		for _, value := range values {
			for _, pattern := range gm.validationRules.BlockedPatterns {
				if pattern.MatchString(value) {
					return fmt.Errorf("blocked pattern in query parameter %s: %s", key, value)
				}
			}
		}
	}

	return nil
}

// CheckConcurrentLimit verifies if we can handle more concurrent requests
func (gm *GuardrailsManager) CheckConcurrentLimit() bool {
	gm.requestMutex.Lock()
	defer gm.requestMutex.Unlock()
	return gm.currentRequests < gm.concurrentLimit
}

// IncrementConcurrent increments the concurrent request counter
func (gm *GuardrailsManager) IncrementConcurrent() {
	gm.requestMutex.Lock()
	defer gm.requestMutex.Unlock()
	gm.currentRequests++
}

// DecrementConcurrent decrements the concurrent request counter
func (gm *GuardrailsManager) DecrementConcurrent() {
	gm.requestMutex.Lock()
	defer gm.requestMutex.Unlock()
	if gm.currentRequests > 0 {
		gm.currentRequests--
	}
}

// CheckCircuitBreaker checks if a service circuit breaker allows requests
func (gm *GuardrailsManager) CheckCircuitBreaker(serviceName string) bool {
	gm.circuitMutex.Lock()
	defer gm.circuitMutex.Unlock()

	breaker, exists := gm.circuitBreakers[serviceName]
	if !exists {
		// Create new circuit breaker
		breaker = &CircuitBreaker{
			State:            CircuitClosed,
			FailureThreshold: 5,
			SuccessThreshold: 3,
			Timeout:          30 * time.Second,
		}
		gm.circuitBreakers[serviceName] = breaker
	}

	breaker.Mutex.Lock()
	defer breaker.Mutex.Unlock()

	switch breaker.State {
	case CircuitClosed:
		return true
	case CircuitOpen:
		if time.Since(breaker.LastFailure) > breaker.Timeout {
			breaker.State = CircuitHalfOpen
			return true
		}
		return false
	case CircuitHalfOpen:
		return true
	default:
		return false
	}
}

// RecordSuccess records a successful request for a service
func (gm *GuardrailsManager) RecordSuccess(serviceName string) {
	gm.circuitMutex.Lock()
	defer gm.circuitMutex.Unlock()

	breaker, exists := gm.circuitBreakers[serviceName]
	if !exists {
		return
	}

	breaker.Mutex.Lock()
	defer breaker.Mutex.Unlock()

	breaker.FailureCount = 0
	breaker.SuccessCount++

	if breaker.State == CircuitHalfOpen && breaker.SuccessCount >= breaker.SuccessThreshold {
		breaker.State = CircuitClosed
		breaker.SuccessCount = 0
	}
}

// RecordFailure records a failed request for a service
func (gm *GuardrailsManager) RecordFailure(serviceName string) {
	gm.circuitMutex.Lock()
	defer gm.circuitMutex.Unlock()

	breaker, exists := gm.circuitBreakers[serviceName]
	if !exists {
		return
	}

	breaker.Mutex.Lock()
	defer breaker.Mutex.Unlock()

	breaker.FailureCount++
	breaker.SuccessCount = 0
	breaker.LastFailure = time.Now()

	if breaker.FailureCount >= breaker.FailureThreshold {
		breaker.State = CircuitOpen
	}
}

// GetMetrics returns current guardrails metrics
func (gm *GuardrailsManager) GetMetrics() GuardrailsMetrics {
	gm.rateLimitMutex.RLock()
	rateLimiterCount := len(gm.rateLimiters)
	gm.rateLimitMutex.RUnlock()

	gm.circuitMutex.RLock()
	circuitBreakerCount := len(gm.circuitBreakers)
	circuitStates := make(map[string]string)
	for name, breaker := range gm.circuitBreakers {
		breaker.Mutex.Lock()
		switch breaker.State {
		case CircuitClosed:
			circuitStates[name] = "closed"
		case CircuitOpen:
			circuitStates[name] = "open"
		case CircuitHalfOpen:
			circuitStates[name] = "half-open"
		}
		breaker.Mutex.Unlock()
	}
	gm.circuitMutex.RUnlock()

	gm.requestMutex.Lock()
	currentReqs := gm.currentRequests
	gm.requestMutex.Unlock()

	return GuardrailsMetrics{
		CurrentConcurrentRequests: currentReqs,
		MaxConcurrentRequests:     gm.concurrentLimit,
		ActiveRateLimiters:        rateLimiterCount,
		ActiveCircuitBreakers:     circuitBreakerCount,
		CircuitBreakerStates:      circuitStates,
		Timestamp:                 time.Now().Unix(),
	}
}

// GuardrailsMiddleware provides comprehensive request protection
func (gm *GuardrailsManager) GuardrailsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check concurrent limit
		if !gm.CheckConcurrentLimit() {
			http.Error(w, "Too many concurrent requests", http.StatusTooManyRequests)
			return
		}

		// Increment concurrent counter
		gm.IncrementConcurrent()
		defer gm.DecrementConcurrent()

		// Validate request
		if err := gm.ValidateRequest(r); err != nil {
			http.Error(w, fmt.Sprintf("Request validation failed: %v", err), http.StatusBadRequest)
			return
		}

		// Check rate limit
		clientID := gm.getClientID(r)
		if !gm.CheckRateLimit(clientID) {
			http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		// Add timeout context
		ctx, cancel := context.WithTimeout(r.Context(), gm.validationRules.RequestTimeout)
		defer cancel()

		// Add security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		// Call next handler
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// getClientID extracts client identifier from request
func (gm *GuardrailsManager) getClientID(r *http.Request) string {
	// Try to get client IP
	clientIP := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		clientIP = strings.Split(forwarded, ",")[0]
	}

	// Add user agent for additional uniqueness
	userAgent := r.Header.Get("User-Agent")
	if userAgent == "" {
		userAgent = "unknown"
	}

	return fmt.Sprintf("%s:%s", clientIP, userAgent)
}

// GuardrailsMetricsHandler provides metrics endpoint
func (gm *GuardrailsManager) GuardrailsMetricsHandler(w http.ResponseWriter, r *http.Request) {
	metrics := gm.GetMetrics()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// HealthCheckHandler provides enhanced health check with guardrails status
func (gm *GuardrailsManager) HealthCheckHandler(w http.ResponseWriter, r *http.Request) {
	metrics := gm.GetMetrics()

	status := "healthy"
	if metrics.CurrentConcurrentRequests > metrics.MaxConcurrentRequests*8/10 {
		status = "degraded"
	}
	if metrics.CurrentConcurrentRequests >= metrics.MaxConcurrentRequests {
		status = "unhealthy"
	}

	response := map[string]interface{}{
		"status":    status,
		"service":   "api-gateway",
		"port":      8081,
		"timestamp": time.Now().Unix(),
		"version":   "1.0.0",
		"guardrails": map[string]interface{}{
			"concurrent_requests": metrics.CurrentConcurrentRequests,
			"max_concurrent":      metrics.MaxConcurrentRequests,
			"rate_limiters":       metrics.ActiveRateLimiters,
			"circuit_breakers":    metrics.ActiveCircuitBreakers,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
