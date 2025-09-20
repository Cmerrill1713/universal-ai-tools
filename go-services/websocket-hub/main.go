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

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

// Message types
const (
	MessageTypeChat         = "chat"
	MessageTypeStatus       = "status"
	MessageTypeTyping       = "typing"
	MessageTypePresence     = "presence"
	MessageTypeNotification = "notification"
	MessageTypeBroadcast    = "broadcast"
	MessageTypeError        = "error"
)

// Connection states
const (
	StateConnected    = "connected"
	StateDisconnected = "disconnected"
	StateIdle         = "idle"
	StateActive       = "active"
)

// Message represents a WebSocket message
type Message struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	UserID    string                 `json:"user_id"`
	Room      string                 `json:"room,omitempty"`
	Content   string                 `json:"content,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// Client represents a WebSocket client
type Client struct {
	ID       string
	UserID   string
	Conn     *websocket.Conn
	Send     chan Message
	Rooms    map[string]bool
	State    string
	LastPing time.Time
	mu       sync.RWMutex
}

// Room represents a chat room or channel
type Room struct {
	ID          string
	Name        string
	Clients     map[*Client]bool
	Private     bool
	MaxClients  int
	CreatedAt   time.Time
	LastMessage time.Time
	mu          sync.RWMutex
}

// Hub maintains active connections and rooms
type Hub struct {
	clients    map[*Client]bool
	clientsMap map[string]*Client // Map UserID to Client
	rooms      map[string]*Room
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	redis      *redis.Client
	mu         sync.RWMutex
}

var (
	hub      *Hub
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			// Configure origin checking for production
			return true
		},
	}
	ctx = context.Background()
)

func init() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Initialize Redis for pub/sub across multiple instances
	redisAddr := getEnvOrDefault("REDIS_ADDR", "localhost:6379")
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
		DB:   1, // Use different DB for WebSocket
	})

	// Test Redis connection
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Failed to connect to Redis: %v", err)
		redisClient = nil
	}

	// Initialize hub
	hub = &Hub{
		clients:    make(map[*Client]bool),
		clientsMap: make(map[string]*Client),
		rooms:      make(map[string]*Room),
		broadcast:  make(chan Message, 256),
		register:   make(chan *Client, 16),
		unregister: make(chan *Client, 16),
		redis:      redisClient,
	}

	// Create default room
	hub.createRoom("general", "General", false, 0)
}

func (h *Hub) run() {
	// Start Redis subscription if available
	if h.redis != nil {
		go h.subscribeRedis()
	}

	// Start ping ticker
	pingTicker := time.NewTicker(30 * time.Second)
	defer pingTicker.Stop()

	// Start cleanup ticker
	cleanupTicker := time.NewTicker(5 * time.Minute)
	defer cleanupTicker.Stop()

	for {
		select {
		case client := <-h.register:
			h.handleRegister(client)

		case client := <-h.unregister:
			h.handleUnregister(client)

		case message := <-h.broadcast:
			h.handleBroadcast(message)

		case <-pingTicker.C:
			h.pingClients()

		case <-cleanupTicker.C:
			h.cleanupInactiveRooms()
		}
	}
}

func (h *Hub) handleRegister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[client] = true
	h.clientsMap[client.UserID] = client

	log.Printf("Client registered: %s (User: %s)", client.ID, client.UserID)

	// Send welcome message
	welcome := Message{
		ID:      uuid.New().String(),
		Type:    MessageTypeStatus,
		Content: "Welcome to the WebSocket hub",
		Data: map[string]interface{}{
			"client_id": client.ID,
			"rooms":     []string{"general"},
		},
		Timestamp: time.Now(),
	}

	select {
	case client.Send <- welcome:
	default:
		// Client send channel full
	}

	// Auto-join general room
	h.joinRoom(client, "general")

	// Broadcast presence
	h.broadcastPresence(client.UserID, StateConnected)
}

func (h *Hub) handleUnregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		delete(h.clientsMap, client.UserID)
		close(client.Send)

		// Leave all rooms
		for roomID := range client.Rooms {
			if room, exists := h.rooms[roomID]; exists {
				room.removeClient(client)
			}
		}

		log.Printf("Client unregistered: %s (User: %s)", client.ID, client.UserID)

		// Broadcast presence
		h.broadcastPresence(client.UserID, StateDisconnected)
	}
}

func (h *Hub) handleBroadcast(message Message) {
	// Publish to Redis for multi-instance support
	if h.redis != nil {
		messageJSON, _ := json.Marshal(message)
		h.redis.Publish(ctx, "websocket:broadcast", messageJSON)
	}

	// Handle based on message type
	switch message.Type {
	case MessageTypeChat:
		h.handleChatMessage(message)
	case MessageTypeTyping:
		h.handleTypingIndicator(message)
	case MessageTypeBroadcast:
		h.broadcastToAll(message)
	default:
		h.handleRoomMessage(message)
	}
}

func (h *Hub) handleChatMessage(message Message) {
	h.mu.RLock()
	room, exists := h.rooms[message.Room]
	h.mu.RUnlock()

	if !exists {
		return
	}

	room.mu.RLock()
	defer room.mu.RUnlock()

	// Send to all clients in room
	for client := range room.Clients {
		select {
		case client.Send <- message:
		default:
			// Client send channel full, remove client
			h.unregister <- client
		}
	}

	room.LastMessage = time.Now()
}

func (h *Hub) handleTypingIndicator(message Message) {
	h.mu.RLock()
	room, exists := h.rooms[message.Room]
	h.mu.RUnlock()

	if !exists {
		return
	}

	// Send typing indicator to others in room
	room.mu.RLock()
	defer room.mu.RUnlock()

	for client := range room.Clients {
		if client.UserID != message.UserID {
			select {
			case client.Send <- message:
			default:
				// Skip if channel full
			}
		}
	}
}

func (h *Hub) broadcastToAll(message Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.Send <- message:
		default:
			// Client send channel full, skip
		}
	}
}

func (h *Hub) handleRoomMessage(message Message) {
	if message.Room == "" {
		return
	}

	h.mu.RLock()
	room, exists := h.rooms[message.Room]
	h.mu.RUnlock()

	if !exists {
		return
	}

	room.broadcast(message)
}

func (h *Hub) broadcastPresence(userID string, state string) {
	presence := Message{
		ID:      uuid.New().String(),
		Type:    MessageTypePresence,
		UserID:  userID,
		Content: state,
		Data: map[string]interface{}{
			"state":     state,
			"timestamp": time.Now().Unix(),
		},
		Timestamp: time.Now(),
	}

	h.broadcastToAll(presence)
}

func (h *Hub) joinRoom(client *Client, roomID string) {
	h.mu.RLock()
	room, exists := h.rooms[roomID]
	h.mu.RUnlock()

	if !exists {
		// Create room if it doesn't exist
		room = h.createRoom(roomID, roomID, false, 0)
	}

	room.addClient(client)
	client.mu.Lock()
	client.Rooms[roomID] = true
	client.mu.Unlock()

	// Notify room members
	joinMessage := Message{
		ID:        uuid.New().String(),
		Type:      MessageTypeStatus,
		UserID:    client.UserID,
		Room:      roomID,
		Content:   fmt.Sprintf("User %s joined the room", client.UserID),
		Timestamp: time.Now(),
	}

	room.broadcast(joinMessage)
}

func (h *Hub) leaveRoom(client *Client, roomID string) {
	h.mu.RLock()
	room, exists := h.rooms[roomID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	room.removeClient(client)
	client.mu.Lock()
	delete(client.Rooms, roomID)
	client.mu.Unlock()

	// Notify room members
	leaveMessage := Message{
		ID:        uuid.New().String(),
		Type:      MessageTypeStatus,
		UserID:    client.UserID,
		Room:      roomID,
		Content:   fmt.Sprintf("User %s left the room", client.UserID),
		Timestamp: time.Now(),
	}

	room.broadcast(leaveMessage)
}

func (h *Hub) createRoom(id, name string, private bool, maxClients int) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	room := &Room{
		ID:         id,
		Name:       name,
		Clients:    make(map[*Client]bool),
		Private:    private,
		MaxClients: maxClients,
		CreatedAt:  time.Now(),
	}

	h.rooms[id] = room
	log.Printf("Room created: %s", id)

	return room
}

func (h *Hub) pingClients() {
	h.mu.RLock()
	clients := make([]*Client, 0, len(h.clients))
	for client := range h.clients {
		clients = append(clients, client)
	}
	h.mu.RUnlock()

	ping := Message{
		ID:        uuid.New().String(),
		Type:      MessageTypeStatus,
		Content:   "ping",
		Timestamp: time.Now(),
	}

	for _, client := range clients {
		select {
		case client.Send <- ping:
			client.LastPing = time.Now()
		default:
			// Client not responding, disconnect
			h.unregister <- client
		}
	}
}

func (h *Hub) cleanupInactiveRooms() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for id, room := range h.rooms {
		// Don't cleanup default room
		if id == "general" {
			continue
		}

		room.mu.RLock()
		isEmpty := len(room.Clients) == 0
		inactive := time.Since(room.LastMessage) > 1*time.Hour
		room.mu.RUnlock()

		if isEmpty && inactive {
			delete(h.rooms, id)
			log.Printf("Cleaned up inactive room: %s", id)
		}
	}
}

func (h *Hub) subscribeRedis() {
	if h.redis == nil {
		return
	}

	pubsub := h.redis.Subscribe(ctx, "websocket:broadcast")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		var message Message
		if err := json.Unmarshal([]byte(msg.Payload), &message); err != nil {
			log.Printf("Failed to unmarshal Redis message: %v", err)
			continue
		}

		// Broadcast to local clients
		h.handleBroadcast(message)
	}
}

// Room methods
func (r *Room) addClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.MaxClients > 0 && len(r.Clients) >= r.MaxClients {
		return // Room full
	}

	r.Clients[client] = true
}

func (r *Room) removeClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Clients, client)
}

func (r *Room) broadcast(message Message) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for client := range r.Clients {
		select {
		case client.Send <- message:
		default:
			// Skip if channel full
		}
	}
}

// Client methods
func (c *Client) readPump() {
	defer func() {
		hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var message Message
		err := c.Conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Set message metadata
		message.ID = uuid.New().String()
		message.UserID = c.UserID
		message.Timestamp = time.Now()

		// Handle special commands
		if message.Type == "join" {
			if roomID, ok := message.Data["room"].(string); ok {
				hub.joinRoom(c, roomID)
			}
			continue
		}

		if message.Type == "leave" {
			if roomID, ok := message.Data["room"].(string); ok {
				hub.leaveRoom(c, roomID)
			}
			continue
		}

		// Broadcast message
		hub.broadcast <- message
	}
}

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

// HTTP handlers
func wsHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		// Try to get from query params
		userID = r.URL.Query().Get("user_id")
		if userID == "" {
			http.Error(w, "User ID required", http.StatusUnauthorized)
			return
		}
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		ID:       uuid.New().String(),
		UserID:   userID,
		Conn:     conn,
		Send:     make(chan Message, 256),
		Rooms:    make(map[string]bool),
		State:    StateConnected,
		LastPing: time.Now(),
	}

	hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

func getRoomsHandler(w http.ResponseWriter, r *http.Request) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()

	rooms := []map[string]interface{}{}
	for _, room := range hub.rooms {
		roomInfo := map[string]interface{}{
			"id":           room.ID,
			"name":         room.Name,
			"private":      room.Private,
			"client_count": len(room.Clients),
			"max_clients":  room.MaxClients,
			"created_at":   room.CreatedAt,
		}
		rooms = append(rooms, roomInfo)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rooms": rooms,
		"total": len(rooms),
	})
}

func getClientsHandler(w http.ResponseWriter, r *http.Request) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()

	clients := []map[string]interface{}{}
	for client := range hub.clients {
		clientInfo := map[string]interface{}{
			"id":        client.ID,
			"user_id":   client.UserID,
			"state":     client.State,
			"rooms":     client.Rooms,
			"last_ping": client.LastPing,
		}
		clients = append(clients, clientInfo)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"clients": clients,
		"total":   len(clients),
	})
}

func broadcastHandler(w http.ResponseWriter, r *http.Request) {
	var message Message
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	message.ID = uuid.New().String()
	message.Type = MessageTypeBroadcast
	message.Timestamp = time.Now()

	hub.broadcast <- message

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	hub.mu.RLock()
	clientCount := len(hub.clients)
	roomCount := len(hub.rooms)
	hub.mu.RUnlock()

	health := map[string]interface{}{
		"status":    "healthy",
		"service":   "websocket-hub",
		"clients":   clientCount,
		"rooms":     roomCount,
		"redis":     hub.redis != nil && hub.redis.Ping(ctx).Err() == nil,
		"timestamp": time.Now().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	// Start hub
	go hub.run()

	router := mux.NewRouter()

	// WebSocket endpoint
	router.HandleFunc("/ws", wsHandler)

	// HTTP endpoints
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.HandleFunc("/rooms", getRoomsHandler).Methods("GET")
	router.HandleFunc("/clients", getClientsHandler).Methods("GET")
	router.HandleFunc("/broadcast", broadcastHandler).Methods("POST")

	// Start server
	port := getEnvOrDefault("WEBSOCKET_PORT", "8082")
	log.Printf("WebSocket Hub starting on port %s", port)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
