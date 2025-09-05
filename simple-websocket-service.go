package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for testing
	},
}

type Client struct {
	ID     string
	UserID string
	Conn   *websocket.Conn
	Send   chan []byte
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

type Message struct {
	Type      string      `json:"type"`
	UserID    string      `json:"user_id,omitempty"`
	Content   interface{} `json:"content"`
	Timestamp time.Time   `json:"timestamp"`
}

var hub = &Hub{
	clients:    make(map[*Client]bool),
	broadcast:  make(chan []byte),
	register:   make(chan *Client),
	unregister: make(chan *Client),
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			
			// Send connection confirmation
			msg := Message{
				Type:      "connected",
				Content:   fmt.Sprintf("Client %s connected", client.ID),
				Timestamp: time.Now(),
			}
			data, _ := json.Marshal(msg)
			select {
			case client.Send <- data:
			default:
				h.closeClient(client)
			}
			
			log.Printf("Client %s (UserID: %s) connected. Total: %d", client.ID, client.UserID, len(h.clients))
			
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			h.mu.Unlock()
			
			log.Printf("Client %s disconnected. Total: %d", client.ID, len(h.clients))
			
		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					h.closeClient(client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) closeClient(client *Client) {
	delete(h.clients, client)
	close(client.Send)
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = "anonymous"
	}
	
	clientID := fmt.Sprintf("client_%d", time.Now().UnixNano())
	client := &Client{
		ID:     clientID,
		UserID: userID,
		Conn:   conn,
		Send:   make(chan []byte, 256),
	}
	
	hub.register <- client
	
	go client.writePump()
	go client.readPump()
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
			
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Write error: %v", err)
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

func (c *Client) readPump() {
	defer func() {
		hub.unregister <- c
		c.Conn.Close()
	}()
	
	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		
		// Parse and broadcast the message
		var msg Message
		if err := json.Unmarshal(message, &msg); err == nil {
			msg.UserID = c.UserID
			msg.Timestamp = time.Now()
			
			if broadcastData, err := json.Marshal(msg); err == nil {
				hub.broadcast <- broadcastData
			}
		}
	}
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "healthy",
		"service":       "websocket-hub",
		"connections":   len(hub.clients),
		"timestamp":     time.Now().Unix(),
	})
}

func broadcastMessage(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Type    string      `json:"type"`
		Content interface{} `json:"content"`
		UserID  string      `json:"user_id,omitempty"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	msg := Message{
		Type:      req.Type,
		Content:   req.Content,
		UserID:    req.UserID,
		Timestamp: time.Now(),
	}
	
	data, err := json.Marshal(msg)
	if err != nil {
		http.Error(w, "Failed to marshal message", http.StatusInternalServerError)
		return
	}
	
	hub.broadcast <- data
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "broadcast",
		"sent_to": len(hub.clients),
	})
}

func getStats(w http.ResponseWriter, r *http.Request) {
	hub.mu.RLock()
	clients := make([]map[string]string, 0, len(hub.clients))
	for client := range hub.clients {
		clients = append(clients, map[string]string{
			"id":      client.ID,
			"user_id": client.UserID,
		})
	}
	hub.mu.RUnlock()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"connections": len(clients),
		"clients":     clients,
	})
}

func main() {
	go hub.run()
	
	r := mux.NewRouter()
	
	// Health check
	r.HandleFunc("/health", healthCheck).Methods("GET")
	
	// WebSocket endpoint
	r.HandleFunc("/ws", handleWebSocket)
	
	// Broadcast endpoint for testing
	r.HandleFunc("/broadcast", broadcastMessage).Methods("POST")
	
	// Stats endpoint
	r.HandleFunc("/stats", getStats).Methods("GET")
	
	fmt.Println("WebSocket Service starting on :8018")
	log.Fatal(http.ListenAndServe(":8018", r))
}