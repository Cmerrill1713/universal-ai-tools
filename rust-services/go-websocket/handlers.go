// HTTP handlers with OpenTelemetry tracing

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// HealthResponse represents the health check response
type HealthResponse struct {
	Status      string                 `json:"status"`
	Service     string                 `json:"service"`
	Version     string                 `json:"version"`
	Timestamp   int64                  `json:"timestamp"`
	Uptime      string                 `json:"uptime"`
	Connections int                    `json:"connections"`
	Redis       string                 `json:"redis"`
	Details     map[string]interface{} `json:"details"`
}

// StatusResponse represents the service status response
type StatusResponse struct {
	Service     string                 `json:"service"`
	Connections int                    `json:"connections"`
	Stats       map[string]interface{} `json:"stats"`
	Timestamp   int64                  `json:"timestamp"`
}

// BroadcastRequest represents a broadcast message request
type BroadcastRequest struct {
	Type     MessageType            `json:"type"`
	Content  string                 `json:"content"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	From     string                 `json:"from,omitempty"`
}

var serviceStartTime = time.Now()

// handleHealth provides health check endpoint
func handleHealth(hub *Hub, w http.ResponseWriter, r *http.Request) {
	tracer := otel.Tracer("websocket-service")
	ctx, span := tracer.Start(r.Context(), "health_check_handler",
		trace.WithAttributes(
			attribute.String("http.method", r.Method),
			attribute.String("http.url", r.URL.String()),
			attribute.String("http.remote_addr", r.RemoteAddr),
		),
	)
	defer span.End()

	hub.mu.RLock()
	connectionCount := len(hub.clients)
	hub.mu.RUnlock()

	// Test Redis connection
	redisStatus := "healthy"
	redisCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	if err := hub.redis.Ping(redisCtx).Err(); err != nil {
		redisStatus = fmt.Sprintf("unhealthy: %v", err)
		span.RecordError(err)
		span.SetAttributes(attribute.String("redis.status", "unhealthy"))
	} else {
		span.SetAttributes(attribute.String("redis.status", "healthy"))
	}

	// Calculate uptime
	uptime := time.Since(serviceStartTime)

	// Determine overall status
	status := "healthy"
	if redisStatus != "healthy" {
		status = "degraded"
	}

	response := HealthResponse{
		Status:      status,
		Service:     "websocket-service",
		Version:     "1.0.0",
		Timestamp:   time.Now().Unix(),
		Uptime:      uptime.String(),
		Connections: connectionCount,
		Redis:       redisStatus,
		Details: map[string]interface{}{
			"uptime_seconds": uptime.Seconds(),
			"memory_stats":   getMemoryStats(),
			"goroutines":     getGoroutineCount(),
		},
	}

	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	if status == "healthy" {
		w.WriteHeader(http.StatusOK)
		span.SetAttributes(attribute.Int("http.status_code", http.StatusOK))
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
		span.SetAttributes(attribute.Int("http.status_code", http.StatusServiceUnavailable))
	}

	// Encode response
	if err := json.NewEncoder(w).Encode(response); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to encode health response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	span.SetAttributes(
		attribute.Int("health.connections", connectionCount),
		attribute.String("health.status", status),
		attribute.Float64("health.uptime_seconds", uptime.Seconds()),
	)
	span.SetStatus(codes.Ok, "Health check completed")
}

// handleStatus provides detailed service status
func handleStatus(hub *Hub, w http.ResponseWriter, r *http.Request) {
	tracer := otel.Tracer("websocket-service")
	_, span := tracer.Start(r.Context(), "status_handler",
		trace.WithAttributes(
			attribute.String("http.method", r.Method),
			attribute.String("http.url", r.URL.String()),
		),
	)
	defer span.End()

	// Get client statistics
	stats := hub.getClientStats()

	response := StatusResponse{
		Service:     "websocket-service",
		Connections: stats["total_clients"].(int),
		Stats:       stats,
		Timestamp:   time.Now().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(response); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to encode status response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	span.SetAttributes(
		attribute.Int("status.connections", response.Connections),
		attribute.Int("status.unique_users", stats["unique_users"].(int)),
	)
	span.SetStatus(codes.Ok, "Status request completed")
}

// handleBroadcast handles broadcast message requests
func handleBroadcast(hub *Hub, w http.ResponseWriter, r *http.Request) {
	tracer := otel.Tracer("websocket-service")
	_, span := tracer.Start(r.Context(), "broadcast_handler",
		trace.WithAttributes(
			attribute.String("http.method", r.Method),
			attribute.String("http.url", r.URL.String()),
		),
	)
	defer span.End()

	if r.Method != http.MethodPost {
		span.SetAttributes(attribute.String("error.reason", "method_not_allowed"))
		span.SetStatus(codes.Error, "Method not allowed")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req BroadcastRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to decode request body")
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Content == "" {
		span.SetAttributes(attribute.String("error.reason", "empty_content"))
		span.SetStatus(codes.Error, "Empty content")
		http.Error(w, "Content cannot be empty", http.StatusBadRequest)
		return
	}

	// Set defaults
	if req.Type == "" {
		req.Type = MessageTypeBroadcast
	}
	if req.From == "" {
		req.From = "api"
	}

	// Create message
	message := Message{
		ID:        generateMessageID(),
		Type:      req.Type,
		From:      req.From,
		Content:   req.Content,
		Metadata:  req.Metadata,
		Timestamp: time.Now(),
	}

	span.SetAttributes(
		attribute.String("broadcast.message_id", message.ID),
		attribute.String("broadcast.type", string(req.Type)),
		attribute.String("broadcast.from", req.From),
		attribute.Int("broadcast.content_length", len(req.Content)),
	)

	// Send to hub for broadcasting
	select {
	case hub.broadcast <- message:
		// Success response
		response := map[string]interface{}{
			"success":    true,
			"message_id": message.ID,
			"timestamp":  message.Timestamp.Unix(),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		if err := json.NewEncoder(w).Encode(response); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "Failed to encode success response")
			return
		}

		span.SetAttributes(attribute.String("broadcast.status", "queued"))
		span.SetStatus(codes.Ok, "Broadcast message queued successfully")

	default:
		// Hub broadcast channel is full
		span.SetAttributes(attribute.String("broadcast.status", "channel_full"))
		span.SetStatus(codes.Error, "Broadcast channel full")
		http.Error(w, "Service temporarily unavailable", http.StatusServiceUnavailable)
	}
}

// getMemoryStats returns basic memory statistics
func getMemoryStats() map[string]interface{} {
	// This is a simplified version - in production you might want to use runtime.MemStats
	return map[string]interface{}{
		"note": "Memory stats not implemented in this demo",
	}
}

// getGoroutineCount returns the number of active goroutines
func getGoroutineCount() int {
	// This is a placeholder - in production you might want to use runtime.NumGoroutine()
	return 0
}
