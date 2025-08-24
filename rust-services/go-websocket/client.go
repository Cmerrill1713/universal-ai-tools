// WebSocket client management with OpenTelemetry tracing

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/gorilla/websocket"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512 * 1024 // 512KB
)

// readPump pumps messages from the websocket connection to the hub
func (c *Client) readPump(ctx context.Context) {
	tracer := otel.Tracer("websocket-service")
	connectionStart := time.Now()

	defer func() {
		// Record connection duration
		duration := time.Since(connectionStart).Seconds()
		c.Hub.metrics.ConnectionDuration.WithLabelValues("closed").Observe(duration)

		// Unregister client
		c.Hub.unregister <- c
		c.Conn.Close()

		log.Printf("WebSocket client disconnected: %s", c.ID)
	}()

	// Set connection limits
	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		c.updateLastSeen()
		return nil
	})

	for {
		// Create span for message processing
		ctx, span := tracer.Start(ctx, "websocket_read_message",
			trace.WithAttributes(
				attribute.String("websocket.client_id", c.ID),
				attribute.String("websocket.user_id", c.UserID),
			),
		)

		var msg Message
		start := time.Now()

		// Read message
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			span.RecordError(err)
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				span.SetStatus(codes.Error, "Unexpected close error")
				c.Hub.metrics.ErrorsTotal.WithLabelValues("read").Inc()
				log.Printf("WebSocket read error: %v", err)
			} else {
				span.SetStatus(codes.Ok, "Connection closed normally")
			}
			span.End()
			break
		}

		// Update last seen
		c.updateLastSeen()

		// Set message metadata
		msg.From = c.UserID
		msg.Timestamp = time.Now()
		if msg.ID == "" {
			msg.ID = generateMessageID()
		}

		// Add span attributes
		span.SetAttributes(
			attribute.String("message.id", msg.ID),
			attribute.String("message.type", string(msg.Type)),
			attribute.String("message.from", msg.From),
			attribute.String("message.to", msg.To),
			attribute.Int("message.content_length", len(msg.Content)),
		)

		// Process message based on type
		switch msg.Type {
		case MessageTypeChat:
			c.handleChatMessage(ctx, span, &msg)
		case MessageTypeHeartbeat:
			c.handleHeartbeat(ctx, span, &msg)
		case MessageTypeBroadcast:
			c.handleBroadcastMessage(ctx, span, &msg)
		default:
			span.SetAttributes(attribute.String("message.status", "unknown_type"))
			log.Printf("Unknown message type: %s", msg.Type)
		}

		// Record metrics
		duration := time.Since(start).Seconds()
		c.Hub.metrics.MessageDuration.WithLabelValues(string(msg.Type)).Observe(duration)
		c.Hub.metrics.MessagesTotal.WithLabelValues(string(msg.Type), "received").Inc()

		span.SetStatus(codes.Ok, "Message processed successfully")
		span.End()
	}
}

// writePump pumps messages from the hub to the websocket connection
func (c *Client) writePump() {
	tracer := otel.Tracer("websocket-service")
	ticker := time.NewTicker(pingPeriod)

	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			// Create span for message sending
			_, span := tracer.Start(context.Background(), "websocket_send_message",
				trace.WithAttributes(
					attribute.String("websocket.client_id", c.ID),
					attribute.String("websocket.user_id", c.UserID),
					attribute.String("message.id", message.ID),
					attribute.String("message.type", string(message.Type)),
				),
			)

			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))

			if !ok {
				// The hub closed the channel
				span.SetAttributes(attribute.String("message.status", "channel_closed"))
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				span.End()
				return
			}

			start := time.Now()

			if err := c.Conn.WriteJSON(message); err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, "Failed to write message")
				c.Hub.metrics.ErrorsTotal.WithLabelValues("write").Inc()
				log.Printf("WebSocket write error: %v", err)
				span.End()
				return
			}

			// Record metrics
			duration := time.Since(start).Seconds()
			c.Hub.metrics.MessageDuration.WithLabelValues(string(message.Type)).Observe(duration)
			c.Hub.metrics.MessagesTotal.WithLabelValues(string(message.Type), "sent").Inc()

			span.SetStatus(codes.Ok, "Message sent successfully")
			span.End()

		case <-ticker.C:
			// Send ping
			_, span := tracer.Start(context.Background(), "websocket_ping",
				trace.WithAttributes(
					attribute.String("websocket.client_id", c.ID),
					attribute.String("websocket.user_id", c.UserID),
				),
			)

			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))

			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, "Failed to send ping")
				c.Hub.metrics.ErrorsTotal.WithLabelValues("ping").Inc()
				span.End()
				return
			}

			span.SetStatus(codes.Ok, "Ping sent successfully")
			span.End()
		}
	}
}

// handleChatMessage processes chat messages
func (c *Client) handleChatMessage(ctx context.Context, span trace.Span, msg *Message) {
	span.SetAttributes(
		attribute.String("message.handler", "chat"),
		attribute.Bool("message.has_recipient", msg.To != ""),
	)

	// Store message in Redis for persistence
	c.storeMessageInRedis(ctx, msg)

	// Route message
	if msg.To != "" {
		// Direct message to specific user
		c.Hub.sendToUser(msg.To, *msg)
		span.SetAttributes(attribute.String("message.routing", "direct"))
	} else {
		// Broadcast to all connected clients
		c.Hub.broadcast <- *msg
		span.SetAttributes(attribute.String("message.routing", "broadcast"))
	}

	log.Printf("Chat message from %s: %s", msg.From, msg.Content)
}

// handleHeartbeat processes heartbeat messages
func (c *Client) handleHeartbeat(ctx context.Context, span trace.Span, msg *Message) {
	span.SetAttributes(attribute.String("message.handler", "heartbeat"))

	// Respond with heartbeat
	response := Message{
		ID:        generateMessageID(),
		Type:      MessageTypeHeartbeat,
		From:      "server",
		To:        c.UserID,
		Content:   "pong",
		Timestamp: time.Now(),
	}

	select {
	case c.Send <- response:
		span.SetAttributes(attribute.String("heartbeat.response", "sent"))
	default:
		span.SetAttributes(attribute.String("heartbeat.response", "channel_full"))
		log.Printf("Failed to send heartbeat response to client %s", c.ID)
	}
}

// handleBroadcastMessage processes broadcast messages
func (c *Client) handleBroadcastMessage(ctx context.Context, span trace.Span, msg *Message) {
	span.SetAttributes(attribute.String("message.handler", "broadcast"))

	// Store in Redis
	c.storeMessageInRedis(ctx, msg)

	// Send to all clients
	c.Hub.broadcast <- *msg

	log.Printf("Broadcast message from %s: %s", msg.From, msg.Content)
}

// storeMessageInRedis stores message in Redis for persistence
func (c *Client) storeMessageInRedis(ctx context.Context, msg *Message) {
	tracer := otel.Tracer("websocket-service")
	ctx, span := tracer.Start(ctx, "redis_store_message",
		trace.WithAttributes(
			attribute.String("redis.operation", "store_message"),
			attribute.String("message.id", msg.ID),
			attribute.String("message.type", string(msg.Type)),
		),
	)
	defer span.End()

	// Serialize message
	data, err := json.Marshal(msg)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to marshal message")
		c.Hub.metrics.RedisOperations.WithLabelValues("store", "error").Inc()
		log.Printf("Failed to marshal message: %v", err)
		return
	}

	// Store in Redis with expiration
	key := fmt.Sprintf("message:%s", msg.ID)
	err = c.Hub.redis.Set(ctx, key, data, 24*time.Hour).Err()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to store message in Redis")
		c.Hub.metrics.RedisOperations.WithLabelValues("store", "error").Inc()
		log.Printf("Failed to store message in Redis: %v", err)
		return
	}

	// Also add to user's message list
	userKey := fmt.Sprintf("user_messages:%s", msg.From)
	err = c.Hub.redis.LPush(ctx, userKey, msg.ID).Err()
	if err != nil {
		span.RecordError(err)
		log.Printf("Failed to add message to user list: %v", err)
	} else {
		// Keep only last 100 messages per user
		c.Hub.redis.LTrim(ctx, userKey, 0, 99)
	}

	span.SetAttributes(
		attribute.String("redis.key", key),
		attribute.Int("message.size_bytes", len(data)),
	)
	span.SetStatus(codes.Ok, "Message stored successfully")
	c.Hub.metrics.RedisOperations.WithLabelValues("store", "success").Inc()
}

// updateLastSeen updates the client's last seen timestamp
func (c *Client) updateLastSeen() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.LastSeen = time.Now()
}

// getLastSeen returns the client's last seen timestamp
func (c *Client) getLastSeen() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.LastSeen
}

// generateMessageID generates a unique message ID
func generateMessageID() string {
	return fmt.Sprintf("msg_%d_%d", time.Now().UnixNano(), rand.Int63())
}
