// Circuit Breaker Pattern Implementation
// Provides fault tolerance and prevents cascade failures
package shared

import (
	"context"
	"errors"
	"sync"
	"time"
)

// CircuitState represents the current state of the circuit breaker
type CircuitState int

const (
	StateClosed CircuitState = iota
	StateHalfOpen
	StateOpen
)

// CircuitBreakerConfig contains configuration for circuit breaker
type CircuitBreakerConfig struct {
	FailureThreshold   int           // Number of failures before opening
	RecoveryTimeout    time.Duration // Time to wait before trying half-open
	RequestVolumeThreshold int       // Minimum requests before evaluating
	ErrorPercentThreshold  int       // Percentage of errors to trigger opening
	SuccessThreshold   int           // Successes in half-open to close
	Timeout           time.Duration // Request timeout
}

// DefaultCircuitBreakerConfig provides sensible defaults
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		FailureThreshold:       5,
		RecoveryTimeout:        30 * time.Second,
		RequestVolumeThreshold: 10,
		ErrorPercentThreshold:  50,
		SuccessThreshold:       3,
		Timeout:               10 * time.Second,
	}
}

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	config       CircuitBreakerConfig
	state        CircuitState
	failures     int
	successes    int
	requests     int
	errors       int
	lastFailTime time.Time
	mutex        sync.RWMutex
}

// NewCircuitBreaker creates a new circuit breaker with the given config
func NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		config: config,
		state:  StateClosed,
	}
}

// Execute runs the given function with circuit breaker protection
func (cb *CircuitBreaker) Execute(ctx context.Context, operation func() (interface{}, error)) (interface{}, error) {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	// Check if circuit breaker should allow the request
	if !cb.allowRequest() {
		return nil, errors.New("circuit breaker is open")
	}

	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, cb.config.Timeout)
	defer cancel()

	// Execute operation with timeout
	resultChan := make(chan struct {
		result interface{}
		error  error
	}, 1)

	go func() {
		result, err := operation()
		resultChan <- struct {
			result interface{}
			error  error
		}{result, err}
	}()

	select {
	case res := <-resultChan:
		cb.onResult(res.error == nil)
		return res.result, res.error
	case <-timeoutCtx.Done():
		cb.onResult(false)
		return nil, errors.New("operation timed out")
	}
}

// allowRequest determines if a request should be allowed based on circuit state
func (cb *CircuitBreaker) allowRequest() bool {
	switch cb.state {
	case StateClosed:
		return true
	case StateOpen:
		if time.Since(cb.lastFailTime) >= cb.config.RecoveryTimeout {
			cb.state = StateHalfOpen
			cb.successes = 0
			return true
		}
		return false
	case StateHalfOpen:
		return true
	default:
		return false
	}
}

// onResult processes the result of an operation
func (cb *CircuitBreaker) onResult(success bool) {
	cb.requests++

	if success {
		cb.successes++
		if cb.state == StateHalfOpen && cb.successes >= cb.config.SuccessThreshold {
			cb.state = StateClosed
			cb.failures = 0
			cb.errors = 0
		}
	} else {
		cb.failures++
		cb.errors++
		cb.lastFailTime = time.Now()

		if cb.state == StateHalfOpen {
			cb.state = StateOpen
		} else if cb.shouldTripCircuit() {
			cb.state = StateOpen
		}
	}
}

// shouldTripCircuit determines if the circuit should be opened
func (cb *CircuitBreaker) shouldTripCircuit() bool {
	if cb.requests < cb.config.RequestVolumeThreshold {
		return false
	}

	errorPercentage := (cb.errors * 100) / cb.requests
	return errorPercentage >= cb.config.ErrorPercentThreshold || 
		   cb.failures >= cb.config.FailureThreshold
}

// GetState returns the current state of the circuit breaker
func (cb *CircuitBreaker) GetState() CircuitState {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()
	return cb.state
}

// GetStats returns current statistics
func (cb *CircuitBreaker) GetStats() map[string]interface{} {
	cb.mutex.RLock()
	defer cb.mutex.RUnlock()

	return map[string]interface{}{
		"state":         cb.state,
		"failures":      cb.failures,
		"successes":     cb.successes,
		"requests":      cb.requests,
		"errors":        cb.errors,
		"error_rate":    float64(cb.errors) / float64(cb.requests) * 100,
		"last_fail_time": cb.lastFailTime,
	}
}

// Reset resets the circuit breaker to closed state
func (cb *CircuitBreaker) Reset() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	cb.state = StateClosed
	cb.failures = 0
	cb.successes = 0
	cb.requests = 0
	cb.errors = 0
	cb.lastFailTime = time.Time{}
}