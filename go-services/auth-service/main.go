package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

// User represents a user in the system
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	APIKey       string    `json:"api_key,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	LastLogin    time.Time `json:"last_login,omitempty"`
}

// Session represents an active user session
type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// AuthService manages authentication
type AuthService struct {
	mu       sync.RWMutex
	users    map[string]*User
	sessions map[string]*Session
	apiKeys  map[string]*User
	jwtSecret []byte
}

// Claims represents JWT claims
type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

var authService *AuthService

func init() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Initialize auth service
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		// Generate a random secret if not provided
		jwtSecret = generateRandomString(32)
		log.Printf("Warning: Using generated JWT secret. Set JWT_SECRET in production.")
	}

	authService = &AuthService{
		users:     make(map[string]*User),
		sessions:  make(map[string]*Session),
		apiKeys:   make(map[string]*User),
		jwtSecret: []byte(jwtSecret),
	}

	// Create default admin user for testing
	authService.createDefaultUser()
}

func (as *AuthService) createDefaultUser() {
	adminEmail := getEnvOrDefault("ADMIN_EMAIL", "admin@example.com")
	adminPassword := getEnvOrDefault("ADMIN_PASSWORD", "admin123")

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	
	admin := &User{
		ID:           generateID(),
		Email:        adminEmail,
		Username:     "admin",
		PasswordHash: string(hashedPassword),
		APIKey:       generateAPIKey(),
		CreatedAt:    time.Now(),
	}

	as.mu.Lock()
	defer as.mu.Unlock()
	
	as.users[admin.Email] = admin
	as.apiKeys[admin.APIKey] = admin
	
	log.Printf("Default admin user created with API key: %s", admin.APIKey)
}

// API Handlers

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Email == "" || req.Password == "" || req.Username == "" {
		http.Error(w, "Email, username and password are required", http.StatusBadRequest)
		return
	}

	// Check if user exists
	authService.mu.RLock()
	if _, exists := authService.users[req.Email]; exists {
		authService.mu.RUnlock()
		http.Error(w, "User already exists", http.StatusConflict)
		return
	}
	authService.mu.RUnlock()

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to process password", http.StatusInternalServerError)
		return
	}

	// Create user
	user := &User{
		ID:           generateID(),
		Email:        req.Email,
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
		APIKey:       generateAPIKey(),
		CreatedAt:    time.Now(),
	}

	// Store user
	authService.mu.Lock()
	authService.users[user.Email] = user
	authService.apiKeys[user.APIKey] = user
	authService.mu.Unlock()

	// Generate JWT token
	token, err := authService.generateJWT(user)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Return response
	response := map[string]interface{}{
		"user": map[string]interface{}{
			"id":       user.ID,
			"email":    user.Email,
			"username": user.Username,
			"api_key":  user.APIKey,
		},
		"token": token,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Find user
	authService.mu.RLock()
	user, exists := authService.users[req.Email]
	authService.mu.RUnlock()

	if !exists {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Update last login
	user.LastLogin = time.Now()

	// Generate JWT token
	token, err := authService.generateJWT(user)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Create session
	session := &Session{
		ID:        generateID(),
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}

	authService.mu.Lock()
	authService.sessions[token] = session
	authService.mu.Unlock()

	// Return response
	response := map[string]interface{}{
		"user": map[string]interface{}{
			"id":       user.ID,
			"email":    user.Email,
			"username": user.Username,
		},
		"token": token,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func verifyHandler(w http.ResponseWriter, r *http.Request) {
	// Get token from header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "No authorization header", http.StatusUnauthorized)
		return
	}

	// Parse token
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	
	// Verify JWT
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return authService.jwtSecret, nil
	})

	if err != nil || !token.Valid {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		http.Error(w, "Invalid token claims", http.StatusUnauthorized)
		return
	}

	// Return user info
	response := map[string]interface{}{
		"valid": true,
		"user": map[string]interface{}{
			"id":       claims.UserID,
			"email":    claims.Email,
			"username": claims.Username,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func verifyAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		http.Error(w, "No API key provided", http.StatusUnauthorized)
		return
	}

	authService.mu.RLock()
	user, exists := authService.apiKeys[apiKey]
	authService.mu.RUnlock()

	if !exists {
		http.Error(w, "Invalid API key", http.StatusUnauthorized)
		return
	}

	response := map[string]interface{}{
		"valid": true,
		"user": map[string]interface{}{
			"id":       user.ID,
			"email":    user.Email,
			"username": user.Username,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	// Get token from header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "No authorization header", http.StatusUnauthorized)
		return
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	
	// Remove session
	authService.mu.Lock()
	delete(authService.sessions, tokenString)
	authService.mu.Unlock()

	response := map[string]interface{}{
		"success": true,
		"message": "Logged out successfully",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func refreshTokenHandler(w http.ResponseWriter, r *http.Request) {
	// Get current token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "No authorization header", http.StatusUnauthorized)
		return
	}

	oldToken := strings.TrimPrefix(authHeader, "Bearer ")
	
	// Verify old token
	token, err := jwt.ParseWithClaims(oldToken, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return authService.jwtSecret, nil
	})

	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		http.Error(w, "Invalid token claims", http.StatusUnauthorized)
		return
	}

	// Find user
	authService.mu.RLock()
	var user *User
	for _, u := range authService.users {
		if u.ID == claims.UserID {
			user = u
			break
		}
	}
	authService.mu.RUnlock()

	if user == nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	// Generate new token
	newToken, err := authService.generateJWT(user)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Update session
	authService.mu.Lock()
	delete(authService.sessions, oldToken)
	authService.sessions[newToken] = &Session{
		ID:        generateID(),
		UserID:    user.ID,
		Token:     newToken,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}
	authService.mu.Unlock()

	response := map[string]interface{}{
		"token": newToken,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Helper functions

func (as *AuthService) generateJWT(user *User) (string, error) {
	claims := &Claims{
		UserID:   user.ID,
		Email:    user.Email,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "universal-ai-tools",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(as.jwtSecret)
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func generateAPIKey() string {
	return "sk-" + generateRandomString(48)
}

func generateRandomString(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)[:length]
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":    "healthy",
		"service":   "auth-service",
		"timestamp": time.Now().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Middleware for validating tokens on other services
func ValidateTokenMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip validation for health check
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		// Check for API key first
		apiKey := r.Header.Get("X-API-Key")
		if apiKey != "" {
			authService.mu.RLock()
			user, exists := authService.apiKeys[apiKey]
			authService.mu.RUnlock()

			if exists {
				// Add user info to request context
				r.Header.Set("X-User-ID", user.ID)
				r.Header.Set("X-User-Email", user.Email)
				next.ServeHTTP(w, r)
				return
			}
		}

		// Check for JWT token
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		
		// Verify JWT
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			return authService.jwtSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok {
			http.Error(w, "Invalid token claims", http.StatusUnauthorized)
			return
		}

		// Add user info to request context
		r.Header.Set("X-User-ID", claims.UserID)
		r.Header.Set("X-User-Email", claims.Email)
		
		next.ServeHTTP(w, r)
	})
}

func main() {
	router := mux.NewRouter()

	// Auth endpoints
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.HandleFunc("/auth/register", registerHandler).Methods("POST")
	router.HandleFunc("/auth/login", loginHandler).Methods("POST")
	router.HandleFunc("/auth/logout", logoutHandler).Methods("POST")
	router.HandleFunc("/auth/verify", verifyHandler).Methods("GET")
	router.HandleFunc("/auth/verify-api-key", verifyAPIKeyHandler).Methods("GET")
	router.HandleFunc("/auth/refresh", refreshTokenHandler).Methods("POST")

	// Start cleanup goroutine for expired sessions
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			authService.mu.Lock()
			now := time.Now()
			for token, session := range authService.sessions {
				if session.ExpiresAt.Before(now) {
					delete(authService.sessions, token)
				}
			}
			authService.mu.Unlock()
		}
	}()

	// Start server
	port := getEnvOrDefault("AUTH_SERVICE_PORT", "8015")
	log.Printf("Auth Service starting on port %s", port)

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