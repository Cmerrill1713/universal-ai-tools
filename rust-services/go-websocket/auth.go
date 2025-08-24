// JWT Authentication Middleware for WebSocket Service
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// getEnv gets environment variable with fallback
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// AuthConfig holds JWT authentication configuration
type AuthConfig struct {
	JWTSecret      string
	JWTIssuer      string
	JWTAudience    []string
	RequireAuth    bool
	AllowAnonymous bool
	TokenExpiry    time.Duration
	RefreshExpiry  time.Duration
}

// Claims represents JWT claims
type Claims struct {
	UserID    string   `json:"user_id"`
	Email     string   `json:"email"`
	Roles     []string `json:"roles"`
	SessionID string   `json:"session_id"`
	jwt.RegisteredClaims
}

// AuthMiddleware handles JWT authentication
type AuthMiddleware struct {
	config *AuthConfig
	tracer trace.Tracer
}

// NewAuthConfig creates default auth configuration
func NewAuthConfig() *AuthConfig {
	return &AuthConfig{
		JWTSecret:      getEnv("JWT_SECRET", "your-super-secret-jwt-key"),
		JWTIssuer:      getEnv("JWT_ISSUER", "universal-ai-tools"),
		JWTAudience:    strings.Split(getEnv("JWT_AUDIENCE", "websocket-service"), ","),
		RequireAuth:    getEnv("REQUIRE_AUTH", "false") == "true",
		AllowAnonymous: getEnv("ALLOW_ANONYMOUS", "true") == "true",
		TokenExpiry:    24 * time.Hour,
		RefreshExpiry:  7 * 24 * time.Hour,
	}
}

// NewAuthMiddleware creates new authentication middleware
func NewAuthMiddleware(config *AuthConfig, tracer trace.Tracer) *AuthMiddleware {
	return &AuthMiddleware{
		config: config,
		tracer: tracer,
	}
}

// Middleware wraps HTTP handlers with authentication
func (am *AuthMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, span := am.tracer.Start(r.Context(), "auth_middleware")
		defer span.End()

		// Skip auth if not required
		if !am.config.RequireAuth {
			span.SetAttributes(attribute.Bool("auth.required", false))
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Extract token
		token := am.extractToken(r)
		if token == "" {
			if am.config.AllowAnonymous {
				span.SetAttributes(attribute.Bool("auth.anonymous", true))
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			span.SetStatus(codes.Error, "No token provided")
			am.sendError(w, "No authorization token provided", http.StatusUnauthorized)
			return
		}

		// Validate token
		claims, err := am.validateToken(token)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "Invalid token")
			am.sendError(w, fmt.Sprintf("Invalid token: %v", err), http.StatusUnauthorized)
			return
		}

		// Add claims to context
		ctx = context.WithValue(ctx, "claims", claims)
		ctx = context.WithValue(ctx, "user_id", claims.UserID)
		ctx = context.WithValue(ctx, "email", claims.Email)
		ctx = context.WithValue(ctx, "roles", claims.Roles)

		span.SetAttributes(
			attribute.String("auth.user_id", claims.UserID),
			attribute.String("auth.email", claims.Email),
			attribute.StringSlice("auth.roles", claims.Roles),
		)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireAdmin ensures user has admin role
func (am *AuthMiddleware) RequireAdmin(next http.Handler) http.Handler {
	return am.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		span := trace.SpanFromContext(ctx)

		// Get roles from context
		roles, ok := ctx.Value("roles").([]string)
		if !ok || !am.hasRole(roles, "admin") {
			span.SetStatus(codes.Error, "Admin access required")
			am.sendError(w, "Admin access required", http.StatusForbidden)
			return
		}

		span.SetAttributes(attribute.Bool("auth.is_admin", true))
		next.ServeHTTP(w, r)
	}))
}

// extractToken gets JWT from Authorization header or query parameter
func (am *AuthMiddleware) extractToken(r *http.Request) string {
	// Check Authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			return parts[1]
		}
	}

	// Check query parameter (for WebSocket connections)
	if token := r.URL.Query().Get("token"); token != "" {
		return token
	}

	// Check cookie
	if cookie, err := r.Cookie("jwt_token"); err == nil {
		return cookie.Value
	}

	return ""
}

// validateToken verifies and parses JWT token
func (am *AuthMiddleware) validateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(am.config.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Validate issuer
	if claims.Issuer != am.config.JWTIssuer {
		return nil, fmt.Errorf("invalid issuer: %s", claims.Issuer)
	}

	// Validate audience
	audienceValid := false
	for _, aud := range claims.Audience {
		for _, expectedAud := range am.config.JWTAudience {
			if aud == expectedAud {
				audienceValid = true
				break
			}
		}
	}
	if !audienceValid {
		return nil, fmt.Errorf("invalid audience")
	}

	return claims, nil
}

// GenerateToken creates a new JWT token
func (am *AuthMiddleware) GenerateToken(userID, email string, roles []string) (string, error) {
	now := time.Now()
	claims := &Claims{
		UserID:    userID,
		Email:     email,
		Roles:     roles,
		SessionID: fmt.Sprintf("session_%d", now.Unix()),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(am.config.TokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    am.config.JWTIssuer,
			Audience:  am.config.JWTAudience,
			ID:        fmt.Sprintf("jwt_%d", now.UnixNano()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(am.config.JWTSecret))
}

// GenerateRefreshToken creates a refresh token
func (am *AuthMiddleware) GenerateRefreshToken(userID string) (string, error) {
	now := time.Now()
	claims := &jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(now.Add(am.config.RefreshExpiry)),
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		Issuer:    am.config.JWTIssuer,
		Subject:   userID,
		ID:        fmt.Sprintf("refresh_%d", now.UnixNano()),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(am.config.JWTSecret))
}

// hasRole checks if user has specific role
func (am *AuthMiddleware) hasRole(roles []string, role string) bool {
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}

// sendError sends JSON error response
func (am *AuthMiddleware) sendError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":     message,
		"code":      code,
		"timestamp": time.Now().UTC(),
	})
}

// GetUserFromContext extracts user ID from context
func GetUserFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value("user_id").(string)
	return userID, ok
}

// GetClaimsFromContext extracts claims from context
func GetClaimsFromContext(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value("claims").(*Claims)
	return claims, ok
}
