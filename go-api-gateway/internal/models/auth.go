// Authentication models and structures
// Compatible with TypeScript API responses and JWT claims

package models

import (
	"github.com/golang-jwt/jwt/v5"
)

// JWTClaims represents the JWT token claims structure
// Maintains compatibility with TypeScript implementation
type JWTClaims struct {
	UserID      string   `json:"userId"`
	Email       string   `json:"email"`
	Username    string   `json:"username,omitempty"`
	IsAdmin     bool     `json:"isAdmin"`
	Permissions []string `json:"permissions"`
	DeviceType  string   `json:"deviceType"`
	Trusted     bool     `json:"trusted"`
	Purpose     string   `json:"purpose"`
	IsDemoToken bool     `json:"isDemoToken"`
	jwt.RegisteredClaims
}

// User represents a user in the system
type User struct {
	ID          string   `json:"id" db:"id"`
	Email       string   `json:"email" db:"email"`
	Username    string   `json:"username" db:"username"`
	IsAdmin     bool     `json:"isAdmin" db:"is_admin"`
	Permissions []string `json:"permissions" db:"permissions"`
	CreatedAt   string   `json:"createdAt" db:"created_at"`
	UpdatedAt   string   `json:"updatedAt" db:"updated_at"`
}

// APIKey represents an API key for authentication
type APIKey struct {
	ID          string   `json:"id" db:"id"`
	UserID      string   `json:"userId" db:"user_id"`
	Key         string   `json:"key" db:"key"`
	Name        string   `json:"name" db:"name"`
	Permissions []string `json:"permissions" db:"permissions"`
	ExpiresAt   *string  `json:"expiresAt" db:"expires_at"`
	CreatedAt   string   `json:"createdAt" db:"created_at"`
	LastUsedAt  *string  `json:"lastUsedAt" db:"last_used_at"`
	IsActive    bool     `json:"isActive" db:"is_active"`
}

// Session represents a user session
type Session struct {
	ID        string `json:"id" db:"id"`
	UserID    string `json:"userId" db:"user_id"`
	TokenID   string `json:"tokenId" db:"token_id"`
	IPAddress string `json:"ipAddress" db:"ip_address"`
	UserAgent string `json:"userAgent" db:"user_agent"`
	ExpiresAt string `json:"expiresAt" db:"expires_at"`
	CreatedAt string `json:"createdAt" db:"created_at"`
	IsActive  bool   `json:"isActive" db:"is_active"`
}

// AuthContext holds authentication context for requests
type AuthContext struct {
	UserID      string   `json:"userId"`
	Email       string   `json:"email"`
	Username    string   `json:"username"`
	IsAdmin     bool     `json:"isAdmin"`
	Permissions []string `json:"permissions"`
	DeviceType  string   `json:"deviceType"`
	IsDemoToken bool     `json:"isDemoToken"`
	TokenID     string   `json:"tokenId"`
}
