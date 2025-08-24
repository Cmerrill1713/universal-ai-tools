// Hub manages WebSocket connections with OpenTelemetry tracing

package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// run starts the hub and handles client registration, unregistration, and message broadcasting
func (h *Hub) run() {
	tracer := otel.Tracer("websocket-service")
	log.Println("WebSocket hub started")

	// Start cleanup routine
	go h.cleanupInactiveClients()

	for {
		select {
		case client := <-h.register:
			ctx, span := tracer.Start(context.Background(), "hub_register_client",
				trace.WithAttributes(
					attribute.String("client.id", client.ID),
					attribute.String("client.user_id", client.UserID),
				),
			)

			h.mu.Lock()
			h.clients[client.ID] = client
			clientCount := len(h.clients)
			h.mu.Unlock()

			// Update metrics
			h.metrics.ConnectedClients.Set(float64(clientCount))

			// Store client info in Redis
			h.storeClientInRedis(ctx, client)

			span.SetAttributes(attribute.Int("hub.total_clients", clientCount))
			span.SetStatus(codes.Ok, "Client registered successfully")
			span.End()

			log.Printf("Client registered: %s (total: %d)", client.ID, clientCount)

		case client := <-h.unregister:
			ctx, span := tracer.Start(context.Background(), "hub_unregister_client",
				trace.WithAttributes(
					attribute.String("client.id", client.ID),
					attribute.String("client.user_id", client.UserID),
				),
			)

			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
				clientCount := len(h.clients)
				h.mu.Unlock()

				// Update metrics
				h.metrics.ConnectedClients.Set(float64(clientCount))

				// Remove client from Redis
				h.removeClientFromRedis(ctx, client)

				span.SetAttributes(attribute.Int("hub.total_clients", clientCount))
				span.SetStatus(codes.Ok, "Client unregistered successfully")

				log.Printf("Client unregistered: %s (total: %d)", client.ID, clientCount)
			} else {
				h.mu.Unlock()
				span.SetAttributes(attribute.String("unregister.status", "client_not_found"))
			}
			span.End()

		case message := <-h.broadcast:
			ctx, span := tracer.Start(context.Background(), "hub_broadcast_message",
				trace.WithAttributes(
					attribute.String("message.id", message.ID),
					attribute.String("message.type", string(message.Type)),
					attribute.String("message.from", message.From),
				),
			)

			h.mu.RLock()
			clientCount := len(h.clients)
			deliveredCount := 0

			for _, client := range h.clients {
				select {
				case client.Send <- message:
					deliveredCount++
				default:
					// Client's send channel is full, close it
					close(client.Send)
					delete(h.clients, client.ID)
					log.Printf("Client %s disconnected due to full send channel", client.ID)
				}
			}
			h.mu.RUnlock()

			// Store broadcast message in Redis
			h.storeBroadcastInRedis(ctx, &message)

			span.SetAttributes(
				attribute.Int("broadcast.total_clients", clientCount),
				attribute.Int("broadcast.delivered_count", deliveredCount),
				attribute.Float64("broadcast.delivery_rate", float64(deliveredCount)/float64(clientCount)),
			)
			span.SetStatus(codes.Ok, "Message broadcasted successfully")
			span.End()

			log.Printf("Message broadcasted to %d/%d clients", deliveredCount, clientCount)
		}
	}
}

// sendToUser sends a message to a specific user
func (h *Hub) sendToUser(userID string, message Message) {
	tracer := otel.Tracer("websocket-service")
	ctx, span := tracer.Start(context.Background(), "hub_send_to_user",
		trace.WithAttributes(
			attribute.String("message.id", message.ID),
			attribute.String("message.type", string(message.Type)),
			attribute.String("message.target_user", userID),
		),
	)
	defer span.End()

	h.mu.RLock()
	defer h.mu.RUnlock()

	delivered := false
	for _, client := range h.clients {
		if client.UserID == userID {
			select {
			case client.Send <- message:
				delivered = true
				span.SetAttributes(
					attribute.String("delivery.status", "delivered"),
					attribute.String("delivery.client_id", client.ID),
				)
				log.Printf("Message delivered to user %s (client: %s)", userID, client.ID)
			default:
				span.SetAttributes(attribute.String("delivery.status", "channel_full"))
				log.Printf("Failed to deliver message to user %s: channel full", userID)
			}
			break
		}
	}

	if !delivered {
		// User not connected, store message for later delivery
		h.storeOfflineMessage(ctx, userID, &message)
		span.SetAttributes(attribute.String("delivery.status", "stored_offline"))
		log.Printf("User %s not connected, message stored for later delivery", userID)
	}

	span.SetStatus(codes.Ok, "Send to user completed")
}

// storeClientInRedis stores client information in Redis
func (h *Hub) storeClientInRedis(ctx context.Context, client *Client) {
	tracer := otel.Tracer("websocket-service")
	ctx, span := tracer.Start(ctx, "redis_store_client",
		trace.WithAttributes(
			attribute.String("redis.operation", "store_client"),
			attribute.String("client.id", client.ID),
			attribute.String("client.user_id", client.UserID),
		),
	)
	defer span.End()

	clientInfo := map[string]interface{}{
		"id":        client.ID,
		"user_id":   client.UserID,
		"connected": time.Now().Unix(),
		"last_seen": client.getLastSeen().Unix(),
	}

	data, err := json.Marshal(clientInfo)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to marshal client info")
		h.metrics.RedisOperations.WithLabelValues("store_client", "error").Inc()
		return
	}

	// Store client info
	key := "client:" + client.ID
	err = h.redis.Set(ctx, key, data, time.Hour).Err()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to store client in Redis")
		h.metrics.RedisOperations.WithLabelValues("store_client", "error").Inc()
		log.Printf("Failed to store client in Redis: %v", err)
		return
	}

	// Add to user's client list
	userKey := "user_clients:" + client.UserID
	err = h.redis.SAdd(ctx, userKey, client.ID).Err()
	if err != nil {
		span.RecordError(err)
		log.Printf("Failed to add client to user set: %v", err)
	} else {
		h.redis.Expire(ctx, userKey, time.Hour)
	}

	span.SetStatus(codes.Ok, "Client stored successfully")
	h.metrics.RedisOperations.WithLabelValues("store_client", "success").Inc()
}

// removeClientFromRedis removes client information from Redis
func (h *Hub) removeClientFromRedis(ctx context.Context, client *Client) {
	tracer := otel.Tracer("websocket-service")
	ctx, span := tracer.Start(ctx, "redis_remove_client",
		trace.WithAttributes(
			attribute.String("redis.operation", "remove_client"),
			attribute.String("client.id", client.ID),
			attribute.String("client.user_id", client.UserID),
		),
	)
	defer span.End()

	// Remove client info
	key := "client:" + client.ID
	err := h.redis.Del(ctx, key).Err()
	if err != nil {
		span.RecordError(err)
		h.metrics.RedisOperations.WithLabelValues("remove_client", "error").Inc()
		log.Printf("Failed to remove client from Redis: %v", err)
	}

	// Remove from user's client list
	userKey := "user_clients:" + client.UserID
	err = h.redis.SRem(ctx, userKey, client.ID).Err()
	if err != nil {
		span.RecordError(err)
		log.Printf("Failed to remove client from user set: %v", err)
	}

	span.SetStatus(codes.Ok, "Client removed successfully")
	h.metrics.RedisOperations.WithLabelValues("remove_client", "success").Inc()
}

// storeBroadcastInRedis stores broadcast message in Redis for history
func (h *Hub) storeBroadcastInRedis(ctx context.Context, message *Message) {
	tracer := otel.Tracer("websocket-service")
	ctx, span := tracer.Start(ctx, "redis_store_broadcast",
		trace.WithAttributes(
			attribute.String("redis.operation", "store_broadcast"),
			attribute.String("message.id", message.ID),
			attribute.String("message.type", string(message.Type)),
		),
	)
	defer span.End()

	data, err := json.Marshal(message)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to marshal broadcast message")
		h.metrics.RedisOperations.WithLabelValues("store_broadcast", "error").Inc()
		return
	}

	// Store broadcast message
	key := "broadcast:" + message.ID
	err = h.redis.Set(ctx, key, data, 24*time.Hour).Err()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to store broadcast message")
		h.metrics.RedisOperations.WithLabelValues("store_broadcast", "error").Inc()
		log.Printf("Failed to store broadcast message: %v", err)
		return
	}

	// Add to broadcast history list
	err = h.redis.LPush(ctx, "broadcast_history", message.ID).Err()
	if err != nil {
		span.RecordError(err)
		log.Printf("Failed to add to broadcast history: %v", err)
	} else {
		// Keep only last 1000 broadcast messages
		h.redis.LTrim(ctx, "broadcast_history", 0, 999)
	}

	span.SetStatus(codes.Ok, "Broadcast message stored successfully")
	h.metrics.RedisOperations.WithLabelValues("store_broadcast", "success").Inc()
}

// storeOfflineMessage stores message for offline user
func (h *Hub) storeOfflineMessage(ctx context.Context, userID string, message *Message) {
	tracer := otel.Tracer("websocket-service")
	ctx, span := tracer.Start(ctx, "redis_store_offline_message",
		trace.WithAttributes(
			attribute.String("redis.operation", "store_offline"),
			attribute.String("message.target_user", userID),
			attribute.String("message.id", message.ID),
		),
	)
	defer span.End()

	data, err := json.Marshal(message)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to marshal offline message")
		h.metrics.RedisOperations.WithLabelValues("store_offline", "error").Inc()
		return
	}

	// Store message
	key := "offline_message:" + message.ID
	err = h.redis.Set(ctx, key, data, 7*24*time.Hour).Err() // 7 days
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to store offline message")
		h.metrics.RedisOperations.WithLabelValues("store_offline", "error").Inc()
		log.Printf("Failed to store offline message: %v", err)
		return
	}

	// Add to user's offline message queue
	userKey := "offline_messages:" + userID
	err = h.redis.LPush(ctx, userKey, message.ID).Err()
	if err != nil {
		span.RecordError(err)
		log.Printf("Failed to add to offline messages queue: %v", err)
	} else {
		h.redis.Expire(ctx, userKey, 7*24*time.Hour)
		// Keep only last 100 offline messages per user
		h.redis.LTrim(ctx, userKey, 0, 99)
	}

	span.SetStatus(codes.Ok, "Offline message stored successfully")
	h.metrics.RedisOperations.WithLabelValues("store_offline", "success").Inc()
}

// cleanupInactiveClients periodically removes inactive clients
func (h *Hub) cleanupInactiveClients() {
	tracer := otel.Tracer("websocket-service")
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		_, span := tracer.Start(context.Background(), "hub_cleanup_inactive_clients")

		h.mu.Lock()
		inactiveThreshold := time.Now().Add(-10 * time.Minute)
		removedCount := 0

		for clientID, client := range h.clients {
			if client.getLastSeen().Before(inactiveThreshold) {
				delete(h.clients, clientID)
				close(client.Send)
				removedCount++
				log.Printf("Removed inactive client: %s", clientID)
			}
		}

		activeCount := len(h.clients)
		h.mu.Unlock()

		// Update metrics
		h.metrics.ConnectedClients.Set(float64(activeCount))

		span.SetAttributes(
			attribute.Int("cleanup.removed_count", removedCount),
			attribute.Int("cleanup.active_count", activeCount),
		)
		span.SetStatus(codes.Ok, "Cleanup completed")
		span.End()

		if removedCount > 0 {
			log.Printf("Cleanup completed: removed %d inactive clients, %d active", removedCount, activeCount)
		}
	}
}

// getClientStats returns statistics about connected clients
func (h *Hub) getClientStats() map[string]interface{} {
	h.mu.RLock()
	defer h.mu.RUnlock()

	userCounts := make(map[string]int)
	totalClients := len(h.clients)

	for _, client := range h.clients {
		userCounts[client.UserID]++
	}

	return map[string]interface{}{
		"total_clients":    totalClients,
		"unique_users":     len(userCounts),
		"clients_per_user": userCounts,
		"timestamp":        time.Now().Unix(),
	}
}
