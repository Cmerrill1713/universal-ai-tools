package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"github.com/rs/cors"
	"golang.org/x/time/rate"
)

// WebSocket message types
type MessageType string

const (
	MessageTypeBroadcast    MessageType = "broadcast"
	MessageTypePrivate      MessageType = "private"
	MessageTypeJoinChannel  MessageType = "join_channel"
	MessageTypeLeaveChannel MessageType = "leave_channel"
	MessageTypeHealthCheck  MessageType = "health_check"
	MessageTypeError        MessageType = "error"
)

// WebSocket message structure
type WSMessage struct {
	ID        string                 `json:"id"`
	Type      MessageType            `json:"type"`
	Channel   string                 `json:"channel,omitempty"`
	From      string                 `json:"from,omitempty"`
	To        string                 `json:"to,omitempty"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Client represents a WebSocket client connection
type Client struct {
	ID         string
	Conn       *websocket.Conn
	Send       chan WSMessage
	Channels   map[string]bool
	UserID     string
	LastSeen   time.Time
	RateLimit  *rate.Limiter
	mutex      sync.RWMutex
}

// Hub manages WebSocket connections and message routing
type Hub struct {
	clients          map[*Client]bool
	channels         map[string]map[*Client]bool
	broadcast        chan WSMessage
	register         chan *Client
	unregister       chan *Client
	redis            *redis.Client
	mutex            sync.RWMutex
	connectionCount  prometheus.Gauge
	messageCount     prometheus.Counter
	channelCount     prometheus.Gauge
	messageLatency   prometheus.Histogram
}

// NewHub creates a new WebSocket hub
func NewHub(redisURL string) *Hub {
	// Setup Redis client
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("Failed to parse Redis URL: %v", err)
		opt = &redis.Options{
			Addr: "localhost:6379",
		}
	}

	rdb := redis.NewClient(opt)

	// Test Redis connection
	ctx := context.Background()
	_, err = rdb.Ping(ctx).Result()
	if err != nil {
		log.Printf("Redis connection failed: %v", err)
	} else {
		log.Println("Connected to Redis successfully")
	}

	// Setup Prometheus metrics
	connectionCount := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "websocket_connections_total",
		Help: "Total number of active WebSocket connections",
	})

	messageCount := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "websocket_messages_total",
		Help: "Total number of WebSocket messages processed",
	})

	channelCount := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "websocket_channels_total",
		Help: "Total number of active channels",
	})

	messageLatency := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "websocket_message_latency_seconds",
		Help:    "WebSocket message processing latency",
		Buckets: prometheus.DefBuckets,
	})

	prometheus.MustRegister(connectionCount, messageCount, channelCount, messageLatency)

	return &Hub{
		clients:         make(map[*Client]bool),
		channels:        make(map[string]map[*Client]bool),
		broadcast:       make(chan WSMessage, 1000),
		register:        make(chan *Client),
		unregister:      make(chan *Client),
		redis:           rdb,
		connectionCount: connectionCount,
		messageCount:    messageCount,
		channelCount:    channelCount,
		messageLatency:  messageLatency,
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	// Start Redis subscription for distributed messaging
	go h.handleRedisMessages()

	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.handleMessage(message)
		}
	}
}

// registerClient adds a new client to the hub
func (h *Hub) registerClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	h.clients[client] = true
	h.connectionCount.Inc()

	log.Printf("Client registered: %s (Total: %d)", client.ID, len(h.clients))

	// Send welcome message
	welcome := WSMessage{
		ID:        uuid.New().String(),
		Type:      MessageTypeBroadcast,
		Payload:   map[string]interface{}{"message": "Connected to WebSocket hub", "client_id": client.ID},
		Timestamp: time.Now(),
	}

	select {
	case client.Send <- welcome:
	default:
		close(client.Send)
		delete(h.clients, client)
		h.connectionCount.Dec()
	}
}

// unregisterClient removes a client from the hub
func (h *Hub) unregisterClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.Send)
		h.connectionCount.Dec()

		// Remove client from all channels
		for channel := range client.Channels {
			h.removeClientFromChannel(client, channel)
		}

		log.Printf("Client unregistered: %s (Total: %d)", client.ID, len(h.clients))
	}
}

// handleMessage processes and routes messages
func (h *Hub) handleMessage(message WSMessage) {
	start := time.Now()
	defer func() {
		h.messageLatency.Observe(time.Since(start).Seconds())
		h.messageCount.Inc()
	}()

	switch message.Type {
	case MessageTypeBroadcast:
		h.broadcastToChannel(message)
	case MessageTypePrivate:
		h.sendPrivateMessage(message)
	case MessageTypeJoinChannel:
		h.handleJoinChannel(message)
	case MessageTypeLeaveChannel:
		h.handleLeaveChannel(message)
	}

	// Publish to Redis for distributed messaging
	h.publishToRedis(message)
}

// broadcastToChannel sends message to all clients in a channel
func (h *Hub) broadcastToChannel(message WSMessage) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	channel := message.Channel
	if channel == "" {
		channel = "global"
	}

	if clients, exists := h.channels[channel]; exists {
		for client := range clients {
			select {
			case client.Send <- message:
			default:
				h.unregisterClient(client)
			}
		}
	}
}

// sendPrivateMessage sends message to a specific client
func (h *Hub) sendPrivateMessage(message WSMessage) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	targetID := message.To
	for client := range h.clients {
		if client.ID == targetID || client.UserID == targetID {
			select {
			case client.Send <- message:
			default:
				h.unregisterClient(client)
			}
			break
		}
	}
}

// handleJoinChannel adds client to a channel
func (h *Hub) handleJoinChannel(message WSMessage) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	channel := message.Channel
	clientID := message.From

	// Find client
	var targetClient *Client
	for client := range h.clients {
		if client.ID == clientID {
			targetClient = client
			break
		}
	}

	if targetClient != nil {
		h.addClientToChannel(targetClient, channel)
	}
}

// handleLeaveChannel removes client from a channel
func (h *Hub) handleLeaveChannel(message WSMessage) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	channel := message.Channel
	clientID := message.From

	// Find client
	var targetClient *Client
	for client := range h.clients {
		if client.ID == clientID {
			targetClient = client
			break
		}
	}

	if targetClient != nil {
		h.removeClientFromChannel(targetClient, channel)
	}
}

// addClientToChannel adds a client to a channel
func (h *Hub) addClientToChannel(client *Client, channel string) {
	if h.channels[channel] == nil {
		h.channels[channel] = make(map[*Client]bool)
	}

	h.channels[channel][client] = true
	client.mutex.Lock()
	client.Channels[channel] = true
	client.mutex.Unlock()

	h.channelCount.Set(float64(len(h.channels)))

	log.Printf("Client %s joined channel %s", client.ID, channel)
}

// removeClientFromChannel removes a client from a channel
func (h *Hub) removeClientFromChannel(client *Client, channel string) {
	if clients, exists := h.channels[channel]; exists {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.channels, channel)
		}
	}

	client.mutex.Lock()
	delete(client.Channels, channel)
	client.mutex.Unlock()

	h.channelCount.Set(float64(len(h.channels)))

	log.Printf("Client %s left channel %s", client.ID, channel)
}

// publishToRedis publishes message to Redis for distributed messaging
func (h *Hub) publishToRedis(message WSMessage) {
	ctx := context.Background()
	messageJSON, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal message for Redis: %v", err)
		return
	}

	channel := fmt.Sprintf("websocket:%s", message.Channel)
	if message.Channel == "" {
		channel = "websocket:global"
	}

	err = h.redis.Publish(ctx, channel, messageJSON).Err()
	if err != nil {
		log.Printf("Failed to publish to Redis: %v", err)
	}
}

// handleRedisMessages subscribes to Redis messages for distributed messaging
func (h *Hub) handleRedisMessages() {
	ctx := context.Background()
	pubsub := h.redis.PSubscribe(ctx, "websocket:*")
	defer pubsub.Close()

	for {
		msg, err := pubsub.ReceiveMessage(ctx)
		if err != nil {
			log.Printf("Redis subscription error: %v", err)
			time.Sleep(time.Second)
			continue
		}

		var wsMessage WSMessage
		err = json.Unmarshal([]byte(msg.Payload), &wsMessage)
		if err != nil {
			log.Printf("Failed to unmarshal Redis message: %v", err)
			continue
		}

		// Only process messages from other instances
		if wsMessage.Metadata != nil {
			if instanceID, ok := wsMessage.Metadata["instance_id"].(string); ok {
				if instanceID == getInstanceID() {
					continue // Skip our own messages
				}
			}
		}

		// Broadcast to local clients
		select {
		case h.broadcast <- wsMessage:
		default:
			log.Println("Broadcast channel full, dropping Redis message")
		}
	}
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// handleWebSocket handles WebSocket connections
func (h *Hub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Create client
	client := &Client{
		ID:        uuid.New().String(),
		Conn:      conn,
		Send:      make(chan WSMessage, 256),
		Channels:  make(map[string]bool),
		UserID:    r.URL.Query().Get("user_id"),
		LastSeen:  time.Now(),
		RateLimit: rate.NewLimiter(rate.Limit(10), 100), // 10 messages per second, burst of 100
	}

	// Register client
	h.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump(h)
}

// readPump handles reading messages from WebSocket
func (c *Client) readPump(hub *Hub) {
	defer func() {
		hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.LastSeen = time.Now()
		return nil
	})

	for {
		var message WSMessage
		err := c.Conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Rate limiting
		if !c.RateLimit.Allow() {
			errorMsg := WSMessage{
				ID:        uuid.New().String(),
				Type:      MessageTypeError,
				Payload:   map[string]interface{}{"error": "Rate limit exceeded"},
				Timestamp: time.Now(),
			}
			select {
			case c.Send <- errorMsg:
			default:
			}
			continue
		}

		// Set message metadata
		message.ID = uuid.New().String()
		message.From = c.ID
		message.Timestamp = time.Now()
		if message.Metadata == nil {
			message.Metadata = make(map[string]interface{})
		}
		message.Metadata["instance_id"] = getInstanceID()

		// Send to hub
		select {
		case hub.broadcast <- message:
		default:
			log.Println("Broadcast channel full, dropping message")
		}
	}
}

// writePump handles writing messages to WebSocket
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteJSON(message); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// HTTP API handlers

// handleBroadcast handles HTTP broadcast requests
func (h *Hub) handleBroadcast(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Channel  string                 `json:"channel"`
		Message  map[string]interface{} `json:"message"`
		Metadata map[string]interface{} `json:"metadata"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	message := WSMessage{
		ID:        uuid.New().String(),
		Type:      MessageTypeBroadcast,
		Channel:   request.Channel,
		Payload:   request.Message,
		Timestamp: time.Now(),
		Metadata:  request.Metadata,
	}

	if message.Metadata == nil {
		message.Metadata = make(map[string]interface{})
	}
	message.Metadata["instance_id"] = getInstanceID()

	select {
	case h.broadcast <- message:
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":    true,
			"message_id": message.ID,
			"timestamp":  message.Timestamp,
		})
	default:
		http.Error(w, "Broadcast channel full", http.StatusServiceUnavailable)
	}
}

// handleHealth provides health check endpoint
func (h *Hub) handleHealth(w http.ResponseWriter, r *http.Request) {
	h.mutex.RLock()
	clientCount := len(h.clients)
	channelCount := len(h.channels)
	h.mutex.RUnlock()

	// Test Redis connection
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	
	redisStatus := "healthy"
	_, err := h.redis.Ping(ctx).Result()
	if err != nil {
		redisStatus = "unhealthy"
	}

	health := map[string]interface{}{
		"status":       "healthy",
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
		"service":      "enhanced-websocket-hub",
		"connections":  clientCount,
		"channels":     channelCount,
		"redis_status": redisStatus,
		"instance_id":  getInstanceID(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// handleStats provides detailed statistics
func (h *Hub) handleStats(w http.ResponseWriter, r *http.Request) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	// Get channel details
	channelDetails := make(map[string]int)
	for channel, clients := range h.channels {
		channelDetails[channel] = len(clients)
	}

	stats := map[string]interface{}{
		"service":         "enhanced-websocket-hub",
		"timestamp":       time.Now().UTC().Format(time.RFC3339),
		"total_clients":   len(h.clients),
		"total_channels":  len(h.channels),
		"channel_details": channelDetails,
		"instance_id":     getInstanceID(),
		"uptime_seconds":  time.Since(startTime).Seconds(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// Global variables
var (
	startTime  = time.Now()
	instanceID = uuid.New().String()
)

// getInstanceID returns the unique instance identifier
func getInstanceID() string {
	return instanceID
}

func main() {
	// Get configuration from environment
	port := os.Getenv("WEBSOCKET_HUB_PORT")
	if port == "" {
		port = "8092"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	// Create hub
	hub := NewHub(redisURL)

	// Start hub
	go hub.Run()

	// Setup HTTP server with CORS
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", hub.handleWebSocket)
	mux.HandleFunc("/broadcast", hub.handleBroadcast)
	mux.HandleFunc("/health", hub.handleHealth)
	mux.HandleFunc("/stats", hub.handleStats)
	mux.Handle("/metrics", promhttp.Handler())

	// CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(mux)

	fmt.Printf("🚀 Enhanced WebSocket Hub starting on port %s\n", port)
	fmt.Printf("📋 Available endpoints:\n")
	fmt.Printf("   WS   /ws        - WebSocket endpoint\n")
	fmt.Printf("   POST /broadcast - HTTP broadcast API\n")
	fmt.Printf("   GET  /health    - Health check\n")
	fmt.Printf("   GET  /stats     - Service statistics\n")
	fmt.Printf("   GET  /metrics   - Prometheus metrics\n")
	fmt.Printf("🔧 Redis URL: %s\n", redisURL)
	fmt.Printf("🆔 Instance ID: %s\n", instanceID)

	log.Fatal(http.ListenAndServe(":"+port, handler))
}
