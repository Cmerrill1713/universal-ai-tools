// Retry Logic Implementation
// Provides configurable retry mechanisms with exponential backoff
package shared

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"time"
)

// RetryConfig contains configuration for retry logic
type RetryConfig struct {
	MaxRetries    int           // Maximum number of retry attempts
	BaseDelay     time.Duration // Base delay between retries
	MaxDelay      time.Duration // Maximum delay between retries
	BackoffFactor float64       // Multiplier for exponential backoff
	Jitter        bool          // Add randomization to prevent thundering herd
	RetryableErrors []string    // Specific errors that should trigger retries
}

// DefaultRetryConfig provides sensible defaults
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:    3,
		BaseDelay:     100 * time.Millisecond,
		MaxDelay:      30 * time.Second,
		BackoffFactor: 2.0,
		Jitter:        true,
		RetryableErrors: []string{
			"connection refused",
			"connection reset",
			"timeout",
			"context deadline exceeded",
			"network is unreachable",
		},
	}
}

// RetryableOperation represents a function that can be retried
type RetryableOperation func() (interface{}, error)

// RetryWithContext executes an operation with retry logic
func RetryWithContext(ctx context.Context, config RetryConfig, operation RetryableOperation) (interface{}, error) {
	var lastErr error
	
	for attempt := 0; attempt <= config.MaxRetries; attempt++ {
		// Check if context is cancelled
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Execute the operation
		result, err := operation()
		if err == nil {
			return result, nil
		}

		lastErr = err

		// Check if this error is retryable
		if !isRetryableError(err, config.RetryableErrors) {
			return nil, fmt.Errorf("non-retryable error: %w", err)
		}

		// Don't sleep on the last attempt
		if attempt == config.MaxRetries {
			break
		}

		// Calculate delay for next attempt
		delay := calculateDelay(attempt, config)
		
		// Sleep with context cancellation support
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
			// Continue to next attempt
		}
	}

	return nil, fmt.Errorf("operation failed after %d attempts: %w", config.MaxRetries+1, lastErr)
}

// calculateDelay computes the delay for the next retry attempt
func calculateDelay(attempt int, config RetryConfig) time.Duration {
	// Calculate exponential backoff
	delay := time.Duration(float64(config.BaseDelay) * math.Pow(config.BackoffFactor, float64(attempt)))
	
	// Cap at maximum delay
	if delay > config.MaxDelay {
		delay = config.MaxDelay
	}

	// Add jitter to prevent thundering herd
	if config.Jitter {
		jitter := time.Duration(rand.Float64() * float64(delay) * 0.1) // 10% jitter
		delay += jitter
	}

	return delay
}

// isRetryableError checks if an error should trigger a retry
func isRetryableError(err error, retryableErrors []string) bool {
	if err == nil {
		return false
	}

	errStr := err.Error()
	for _, retryableErr := range retryableErrors {
		if contains(errStr, retryableErr) {
			return true
		}
	}

	return false
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && 
		   (s == substr || 
		    (len(s) > len(substr) && 
		     (s[:len(substr)] == substr || 
		      s[len(s)-len(substr):] == substr || 
		      containsSubstring(s, substr))))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// RetryWithCircuitBreaker combines retry logic with circuit breaker
func RetryWithCircuitBreaker(ctx context.Context, retryConfig RetryConfig, cb *CircuitBreaker, operation RetryableOperation) (interface{}, error) {
	retryableOp := func() (interface{}, error) {
		return cb.Execute(ctx, operation)
	}

	return RetryWithContext(ctx, retryConfig, retryableOp)
}

// BackoffStrategy represents different backoff strategies
type BackoffStrategy int

const (
	LinearBackoff BackoffStrategy = iota
	ExponentialBackoff
	FixedBackoff
)

// AdvancedRetryConfig provides more sophisticated retry configuration
type AdvancedRetryConfig struct {
	RetryConfig
	Strategy        BackoffStrategy
	MaxJitter       time.Duration
	RetryCondition  func(error) bool // Custom retry condition
	OnRetry         func(attempt int, err error) // Callback on retry
}

// RetryWithAdvancedConfig executes operation with advanced retry configuration
func RetryWithAdvancedConfig(ctx context.Context, config AdvancedRetryConfig, operation RetryableOperation) (interface{}, error) {
	var lastErr error
	
	for attempt := 0; attempt <= config.MaxRetries; attempt++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		result, err := operation()
		if err == nil {
			return result, nil
		}

		lastErr = err

		// Use custom retry condition if provided, otherwise use default
		shouldRetry := config.RetryCondition != nil && config.RetryCondition(err) ||
					  config.RetryCondition == nil && isRetryableError(err, config.RetryableErrors)

		if !shouldRetry {
			return nil, fmt.Errorf("non-retryable error: %w", err)
		}

		// Call retry callback if provided
		if config.OnRetry != nil {
			config.OnRetry(attempt, err)
		}

		if attempt == config.MaxRetries {
			break
		}

		delay := calculateAdvancedDelay(attempt, config)
		
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
	}

	return nil, fmt.Errorf("operation failed after %d attempts: %w", config.MaxRetries+1, lastErr)
}

// calculateAdvancedDelay computes delay based on strategy
func calculateAdvancedDelay(attempt int, config AdvancedRetryConfig) time.Duration {
	var delay time.Duration

	switch config.Strategy {
	case LinearBackoff:
		delay = config.BaseDelay * time.Duration(attempt+1)
	case ExponentialBackoff:
		delay = time.Duration(float64(config.BaseDelay) * math.Pow(config.BackoffFactor, float64(attempt)))
	case FixedBackoff:
		delay = config.BaseDelay
	default:
		delay = calculateDelay(attempt, config.RetryConfig)
	}

	if delay > config.MaxDelay {
		delay = config.MaxDelay
	}

	if config.Jitter && config.MaxJitter > 0 {
		jitter := time.Duration(rand.Float64() * float64(config.MaxJitter))
		delay += jitter
	}

	return delay
}