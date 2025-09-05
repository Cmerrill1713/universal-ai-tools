package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Created  time.Time `json:"created"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// Simple in-memory user store for testing
var users = map[string]User{
	"admin": {
		ID:       "user-001",
		Username: "admin",
		Email:    "admin@example.com",
		Created:  time.Now(),
	},
	"test": {
		ID:       "user-002", 
		Username: "test",
		Email:    "test@example.com",
		Created:  time.Now(),
	},
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "healthy",
		"service": "auth-service",
		"timestamp": time.Now().Unix(),
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	user, exists := users[req.Username]
	if !exists {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}
	
	// Simple password check (for testing)
	if req.Password != "password" && req.Password != req.Username {
		http.Error(w, "Invalid password", http.StatusUnauthorized)
		return
	}
	
	// Generate simple token
	token := fmt.Sprintf("token_%s_%d", user.ID, time.Now().Unix())
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	if _, exists := users[req.Username]; exists {
		http.Error(w, "User already exists", http.StatusConflict)
		return
	}
	
	user := User{
		ID:       uuid.New().String(),
		Username: req.Username,
		Email:    req.Email,
		Created:  time.Now(),
	}
	
	users[req.Username] = user
	
	// Generate token
	token := fmt.Sprintf("token_%s_%d", user.ID, time.Now().Unix())
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

func verifyHandler(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Missing authorization header", http.StatusUnauthorized)
		return
	}
	
	// Simple token validation (for testing)
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token := authHeader[7:]
		if len(token) > 10 { // Basic validation
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"valid": true,
				"token": token,
			})
			return
		}
	}
	
	http.Error(w, "Invalid token", http.StatusUnauthorized)
}

func main() {
	r := mux.NewRouter()
	
	// Health check
	r.HandleFunc("/health", healthCheck).Methods("GET")
	
	// Auth endpoints
	r.HandleFunc("/login", loginHandler).Methods("POST")
	r.HandleFunc("/register", registerHandler).Methods("POST")
	r.HandleFunc("/verify", verifyHandler).Methods("GET")
	
	// User list (for testing)
	r.HandleFunc("/users", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(users)
	}).Methods("GET")
	
	fmt.Println("Auth Service starting on :8015")
	log.Fatal(http.ListenAndServe(":8015", r))
}