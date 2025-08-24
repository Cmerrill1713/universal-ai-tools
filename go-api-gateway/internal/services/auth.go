// Authentication service for Go API Gateway
// Handles user authentication, JWT management, and session handling

package services

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/models"
)

var (
	ErrUserNotFound    = errors.New("user not found")
	ErrInvalidPassword = errors.New("invalid password")
	ErrUserExists      = errors.New("user already exists")
	ErrInvalidAPIKey   = errors.New("invalid API key")
)

// AuthService handles authentication operations
type AuthService struct {
	config     *config.Config
	logger     *zap.Logger
	db         *pgxpool.Pool
	redis      *redis.Client
	jwtService *JWTService
}

// NewAuthService creates a new authentication service
func NewAuthService(
	cfg *config.Config,
	logger *zap.Logger,
	db *pgxpool.Pool,
	redisClient *redis.Client,
	jwtService *JWTService,
) *AuthService {
	return &AuthService{
		config:     cfg,
		logger:     logger,
		db:         db,
		redis:      redisClient,
		jwtService: jwtService,
	}
}

// AuthenticateUser verifies user credentials and returns user info
func (s *AuthService) AuthenticateUser(ctx context.Context, email, password string) (*models.User, error) {
	var user models.User
	var hashedPassword string

	query := `
		SELECT id, email, username, password_hash, is_admin, permissions, created_at, updated_at
		FROM users 
		WHERE email = $1 AND is_active = true
	`

	err := s.db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&hashedPassword,
		&user.IsAdmin,
		&user.Permissions,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		s.logger.Error("Failed to query user",
			zap.Error(err),
			zap.String("email", email),
		)
		return nil, ErrUserNotFound
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)); err != nil {
		s.logger.Warn("Invalid password attempt",
			zap.String("email", email),
			zap.String("user_id", user.ID),
		)
		return nil, ErrInvalidPassword
	}

	s.logger.Info("User authenticated successfully",
		zap.String("user_id", user.ID),
		zap.String("email", email),
	)

	return &user, nil
}

// CreateUser creates a new user account
func (s *AuthService) CreateUser(ctx context.Context, email, username, password string) (*models.User, error) {
	// Check if user already exists
	var exists bool
	err := s.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrUserExists
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), s.config.Security.BCryptCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user := &models.User{
		Email:       email,
		Username:    username,
		IsAdmin:     false,
		Permissions: []string{"api_access", "chat"},
	}

	query := `
		INSERT INTO users (email, username, password_hash, is_admin, permissions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`

	err = s.db.QueryRow(ctx, query,
		user.Email,
		user.Username,
		string(hashedPassword),
		user.IsAdmin,
		user.Permissions,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		s.logger.Error("Failed to create user",
			zap.Error(err),
			zap.String("email", email),
		)
		return nil, err
	}

	s.logger.Info("User created successfully",
		zap.String("user_id", user.ID),
		zap.String("email", email),
	)

	return user, nil
}

// GetUserByID retrieves a user by ID
func (s *AuthService) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	var user models.User

	query := `
		SELECT id, email, username, is_admin, permissions, created_at, updated_at
		FROM users 
		WHERE id = $1 AND is_active = true
	`

	err := s.db.QueryRow(ctx, query, userID).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.IsAdmin,
		&user.Permissions,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, ErrUserNotFound
	}

	return &user, nil
}

// ValidateAPIKey validates an API key and returns associated user
func (s *AuthService) ValidateAPIKey(ctx context.Context, apiKey string) (*models.User, error) {
	var userID string
	var apiKeyRecord models.APIKey

	query := `
		SELECT ak.user_id, ak.id, ak.name, ak.permissions, ak.expires_at, ak.last_used_at
		FROM api_keys ak
		WHERE ak.key = $1 AND ak.is_active = true
		AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
	`

	err := s.db.QueryRow(ctx, query, apiKey).Scan(
		&userID,
		&apiKeyRecord.ID,
		&apiKeyRecord.Name,
		&apiKeyRecord.Permissions,
		&apiKeyRecord.ExpiresAt,
		&apiKeyRecord.LastUsedAt,
	)

	if err != nil {
		return nil, ErrInvalidAPIKey
	}

	// Update last used timestamp
	go func() {
		updateCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_, err := s.db.Exec(updateCtx,
			"UPDATE api_keys SET last_used_at = NOW() WHERE id = $1",
			apiKeyRecord.ID,
		)
		if err != nil {
			s.logger.Error("Failed to update API key last used timestamp",
				zap.Error(err),
				zap.String("api_key_id", apiKeyRecord.ID),
			)
		}
	}()

	// Get user information
	user, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// CreateAPIKey creates a new API key for a user
func (s *AuthService) CreateAPIKey(ctx context.Context, userID, name string, permissions []string, expiresAt *time.Time) (*models.APIKey, error) {
	// Generate API key
	apiKey := "uai_" + generateRandomString(32)

	query := `
		INSERT INTO api_keys (user_id, key, name, permissions, expires_at, created_at, is_active)
		VALUES ($1, $2, $3, $4, $5, NOW(), true)
		RETURNING id, created_at
	`

	var id, createdAt string
	err := s.db.QueryRow(ctx, query, userID, apiKey, name, permissions, expiresAt).Scan(&id, &createdAt)
	if err != nil {
		return nil, err
	}

	return &models.APIKey{
		ID:          id,
		UserID:      userID,
		Key:         apiKey,
		Name:        name,
		Permissions: permissions,
		ExpiresAt:   timeToString(expiresAt),
		CreatedAt:   createdAt,
		IsActive:    true,
	}, nil
}

// RevokeAPIKey revokes an API key
func (s *AuthService) RevokeAPIKey(ctx context.Context, userID, apiKeyID string) error {
	query := `UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2`

	result, err := s.db.Exec(ctx, query, apiKeyID, userID)
	if err != nil {
		return err
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrInvalidAPIKey
	}

	return nil
}

// CreateSession creates a new user session
func (s *AuthService) CreateSession(ctx context.Context, userID, tokenID, ipAddress, userAgent string, expiresAt time.Time) error {
	query := `
		INSERT INTO sessions (user_id, token_id, ip_address, user_agent, expires_at, created_at, is_active)
		VALUES ($1, $2, $3, $4, $5, NOW(), true)
	`

	_, err := s.db.Exec(ctx, query, userID, tokenID, ipAddress, userAgent, expiresAt)
	if err != nil {
		s.logger.Error("Failed to create session",
			zap.Error(err),
			zap.String("user_id", userID),
			zap.String("token_id", tokenID),
		)
		return err
	}

	return nil
}

// RevokeSession revokes a user session
func (s *AuthService) RevokeSession(ctx context.Context, tokenID string) error {
	query := `UPDATE sessions SET is_active = false WHERE token_id = $1`

	_, err := s.db.Exec(ctx, query, tokenID)
	if err != nil {
		s.logger.Error("Failed to revoke session",
			zap.Error(err),
			zap.String("token_id", tokenID),
		)
		return err
	}

	return nil
}

// IsSessionValid checks if a session is still valid
func (s *AuthService) IsSessionValid(ctx context.Context, tokenID string) (bool, error) {
	var exists bool

	query := `
		SELECT EXISTS(
			SELECT 1 FROM sessions 
			WHERE token_id = $1 AND is_active = true AND expires_at > NOW()
		)
	`

	err := s.db.QueryRow(ctx, query, tokenID).Scan(&exists)
	if err != nil {
		return false, err
	}

	return exists, nil
}

// Helper functions

func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

func timeToString(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}
