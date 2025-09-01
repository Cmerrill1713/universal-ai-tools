// Resilience Patterns Implementation
// Combines circuit breaker, retry, timeout, and bulkhead patterns
package shared

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// ResilienceConfig combines all resilience pattern configurations
type ResilienceConfig struct {
	CircuitBreaker *CircuitBreakerConfig
	Retry          *RetryConfig
	Timeout        time.Duration
	BulkheadSize   int // Maximum concurrent operations
}

// DefaultResilienceConfig provides comprehensive defaults
func DefaultResilienceConfig() ResilienceConfig {
	cbConfig := DefaultCircuitBreakerConfig()
	retryConfig := DefaultRetryConfig()
	
	return ResilienceConfig{
		CircuitBreaker: &cbConfig,
		Retry:          &retryConfig,
		Timeout:        30 * time.Second,
		BulkheadSize:   100,
	}
}

// ResilienceManager manages all resilience patterns
type ResilienceManager struct {
	circuitBreaker *CircuitBreaker
	config         ResilienceConfig
	semaphore      chan struct{} // For bulkhead pattern
	metrics        *ResilienceMetrics
}

// ResilienceMetrics tracks resilience pattern usage
type ResilienceMetrics struct {
	mutex                sync.RWMutex
	TotalRequests        int64
	SuccessfulRequests   int64
	FailedRequests       int64
	RejectedRequests     int64
	TimeoutRequests      int64
	CircuitBreakerTrips  int64
	RetryAttempts        int64
	BulkheadRejections   int64
}

// NewResilienceManager creates a new resilience manager
func NewResilienceManager(config ResilienceConfig) *ResilienceManager {
	var cb *CircuitBreaker
	if config.CircuitBreaker != nil {
		cb = NewCircuitBreaker(*config.CircuitBreaker)
	}

	// Create semaphore for bulkhead pattern
	semaphore := make(chan struct{}, config.BulkheadSize)

	return &ResilienceManager{
		circuitBreaker: cb,
		config:         config,
		semaphore:      semaphore,
		metrics:        &ResilienceMetrics{},
	}
}

// Execute runs an operation with all configured resilience patterns
func (rm *ResilienceManager) Execute(ctx context.Context, operation RetryableOperation) (interface{}, error) {
	rm.metrics.incrementTotalRequests()

	// Apply bulkhead pattern (limit concurrent operations)
	if !rm.acquireBulkhead() {
		rm.metrics.incrementBulkheadRejections()
		rm.metrics.incrementRejectedRequests()
		return nil, fmt.Errorf("bulkhead limit exceeded, request rejected")
	}
	defer rm.releaseBulkhead()

	// Apply timeout at the highest level
	timeoutCtx := ctx
	if rm.config.Timeout > 0 {
		var cancel context.CancelFunc
		timeoutCtx, cancel = context.WithTimeout(ctx, rm.config.Timeout)
		defer cancel()
	}

	// Combine all patterns
	resilientOperation := func() (interface{}, error) {
		if rm.circuitBreaker != nil {
			// Use circuit breaker with retry
			return rm.executeWithCircuitBreakerAndRetry(timeoutCtx, operation)
		} else if rm.config.Retry != nil {
			// Use retry without circuit breaker
			return RetryWithContext(timeoutCtx, *rm.config.Retry, operation)
		} else {
			// Direct execution
			return operation()
		}
	}

	// Execute with timeout monitoring
	resultChan := make(chan struct {
		result interface{}
		error  error
	}, 1)

	go func() {
		result, err := resilientOperation()
		resultChan <- struct {
			result interface{}
			error  error
		}{result, err}
	}()

	select {
	case res := <-resultChan:
		if res.error != nil {
			rm.metrics.incrementFailedRequests()
		} else {
			rm.metrics.incrementSuccessfulRequests()
		}
		return res.result, res.error
	case <-timeoutCtx.Done():
		rm.metrics.incrementTimeoutRequests()
		rm.metrics.incrementFailedRequests()
		return nil, fmt.Errorf("operation timed out after %v", rm.config.Timeout)
	}
}

// executeWithCircuitBreakerAndRetry combines circuit breaker and retry patterns
func (rm *ResilienceManager) executeWithCircuitBreakerAndRetry(ctx context.Context, operation RetryableOperation) (interface{}, error) {
	retryableOp := func() (interface{}, error) {
		result, err := rm.circuitBreaker.Execute(ctx, operation)
		if err != nil && err.Error() == "circuit breaker is open" {
			rm.metrics.incrementCircuitBreakerTrips()
			return nil, err
		}
		return result, err
	}

	if rm.config.Retry != nil {
		// Custom retry logic that counts retry attempts
		var lastErr error
		for attempt := 0; attempt <= rm.config.Retry.MaxRetries; attempt++ {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			default:
			}

			result, err := retryableOp()
			if err == nil {
				return result, nil
			}

			lastErr = err
			if attempt > 0 {
				rm.metrics.incrementRetryAttempts()
			}

			// Check if this error is retryable
			if !isRetryableError(err, rm.config.Retry.RetryableErrors) {
				return nil, fmt.Errorf("non-retryable error: %w", err)
			}

			if attempt == rm.config.Retry.MaxRetries {
				break
			}

			delay := calculateDelay(attempt, *rm.config.Retry)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}

		return nil, fmt.Errorf("operation failed after %d attempts: %w", rm.config.Retry.MaxRetries+1, lastErr)
	}

	return retryableOp()
}

// acquireBulkhead attempts to acquire a bulkhead slot
func (rm *ResilienceManager) acquireBulkhead() bool {
	select {
	case rm.semaphore <- struct{}{}:
		return true
	default:
		return false
	}
}

// releaseBulkhead releases a bulkhead slot
func (rm *ResilienceManager) releaseBulkhead() {
	<-rm.semaphore
}

// GetMetrics returns current resilience metrics
func (rm *ResilienceManager) GetMetrics() ResilienceMetrics {
	rm.metrics.mutex.RLock()
	defer rm.metrics.mutex.RUnlock()
	
	return *rm.metrics
}

// GetCircuitBreakerStats returns circuit breaker statistics
func (rm *ResilienceManager) GetCircuitBreakerStats() map[string]interface{} {
	if rm.circuitBreaker != nil {
		return rm.circuitBreaker.GetStats()
	}
	return nil
}

// Reset resets all resilience pattern states
func (rm *ResilienceManager) Reset() {
	if rm.circuitBreaker != nil {
		rm.circuitBreaker.Reset()
	}
	
	rm.metrics.mutex.Lock()
	defer rm.metrics.mutex.Unlock()
	
	rm.metrics.TotalRequests = 0
	rm.metrics.SuccessfulRequests = 0
	rm.metrics.FailedRequests = 0
	rm.metrics.RejectedRequests = 0
	rm.metrics.TimeoutRequests = 0
	rm.metrics.CircuitBreakerTrips = 0
	rm.metrics.RetryAttempts = 0
	rm.metrics.BulkheadRejections = 0
}

// Metric increment methods
func (m *ResilienceMetrics) incrementTotalRequests() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.TotalRequests++
}

func (m *ResilienceMetrics) incrementSuccessfulRequests() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.SuccessfulRequests++
}

func (m *ResilienceMetrics) incrementFailedRequests() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.FailedRequests++
}

func (m *ResilienceMetrics) incrementRejectedRequests() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.RejectedRequests++
}

func (m *ResilienceMetrics) incrementTimeoutRequests() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.TimeoutRequests++
}

func (m *ResilienceMetrics) incrementCircuitBreakerTrips() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.CircuitBreakerTrips++
}

func (m *ResilienceMetrics) incrementRetryAttempts() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.RetryAttempts++
}

func (m *ResilienceMetrics) incrementBulkheadRejections() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.BulkheadRejections++
}