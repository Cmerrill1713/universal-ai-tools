// JWT service for Go API Gateway
// Handles JWT token generation, validation, and management

package services

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/models"
)

var (
	ErrInvalidToken   = errors.New("invalid token")
	ErrExpiredToken   = errors.New("token has expired")
	ErrMalformedToken = errors.New("malformed token")
)

// JWTService handles JWT operations
type JWTService struct {
	config *config.Config
	logger *zap.Logger
	secret []byte
}

// NewJWTService creates a new JWT service
func NewJWTService(cfg *config.Config, logger *zap.Logger) *JWTService {
	return &JWTService{
		config: cfg,
		logger: logger,
		secret: []byte(cfg.Security.JWTSecret),
	}
}

// GenerateToken generates a new JWT token with the given claims
func (s *JWTService) GenerateToken(claims *models.JWTClaims) (string, error) {
	// Create token with claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign token with secret
	tokenString, err := token.SignedString(s.secret)
	if err != nil {
		s.logger.Error("Failed to sign JWT token",
			zap.Error(err),
			zap.String("user_id", claims.UserID),
		)
		return "", err
	}

	s.logger.Debug("JWT token generated",
		zap.String("user_id", claims.UserID),
		zap.String("token_id", claims.ID),
		zap.Time("expires_at", claims.ExpiresAt.Time),
		zap.Bool("is_demo_token", claims.IsDemoToken),
	)

	return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func (s *JWTService) ValidateToken(tokenString string) (*models.JWTClaims, error) {
	// Parse token
	token, err := jwt.ParseWithClaims(tokenString, &models.JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.secret, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		if errors.Is(err, jwt.ErrTokenMalformed) {
			return nil, ErrMalformedToken
		}
		s.logger.Debug("Token validation failed",
			zap.Error(err),
		)
		return nil, ErrInvalidToken
	}

	// Extract claims
	claims, ok := token.Claims.(*models.JWTClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	// Additional validation
	if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, ErrExpiredToken
	}

	s.logger.Debug("JWT token validated",
		zap.String("user_id", claims.UserID),
		zap.String("token_id", claims.ID),
		zap.Bool("is_demo_token", claims.IsDemoToken),
	)

	return claims, nil
}

// RefreshToken creates a new token with extended expiration
func (s *JWTService) RefreshToken(oldToken string) (string, error) {
	// Validate old token (even if expired)
	claims, err := s.parseTokenWithoutValidation(oldToken)
	if err != nil {
		return "", err
	}

	// Create new claims with extended expiration
	now := time.Now()
	newClaims := &models.JWTClaims{
		UserID:      claims.UserID,
		Email:       claims.Email,
		Username:    claims.Username,
		IsAdmin:     claims.IsAdmin,
		Permissions: claims.Permissions,
		DeviceType:  claims.DeviceType,
		Trusted:     claims.Trusted,
		Purpose:     claims.Purpose,
		IsDemoToken: claims.IsDemoToken,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    claims.Issuer,
			Audience:  claims.Audience,
			Subject:   claims.Subject,
			ExpiresAt: jwt.NewNumericDate(now.Add(s.config.Security.JWTExpiration)),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        claims.ID, // Keep same token ID for session tracking
		},
	}

	return s.GenerateToken(newClaims)
}

// parseTokenWithoutValidation parses a token without validating expiration
func (s *JWTService) parseTokenWithoutValidation(tokenString string) (*models.JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &models.JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.secret, nil
	}, jwt.WithoutClaimsValidation())

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*models.JWTClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// GetTokenClaims extracts claims from a token without full validation
func (s *JWTService) GetTokenClaims(tokenString string) (*models.JWTClaims, error) {
	return s.parseTokenWithoutValidation(tokenString)
}

// IsTokenExpired checks if a token is expired
func (s *JWTService) IsTokenExpired(tokenString string) bool {
	claims, err := s.parseTokenWithoutValidation(tokenString)
	if err != nil {
		return true
	}

	if claims.ExpiresAt == nil {
		return false
	}

	return claims.ExpiresAt.Time.Before(time.Now())
}

// RevokeToken marks a token as revoked (would require additional storage in production)
func (s *JWTService) RevokeToken(tokenString string) error {
	claims, err := s.parseTokenWithoutValidation(tokenString)
	if err != nil {
		return err
	}

	// In a production system, you would store revoked token IDs in Redis or database
	s.logger.Info("Token revoked",
		zap.String("user_id", claims.UserID),
		zap.String("token_id", claims.ID),
	)

	return nil
}

// CreateStandardClaims creates standard JWT claims for a user
func (s *JWTService) CreateStandardClaims(user *models.User, tokenID, deviceType string, isDemoToken bool) *models.JWTClaims {
	now := time.Now()

	return &models.JWTClaims{
		UserID:      user.ID,
		Email:       user.Email,
		Username:    user.Username,
		IsAdmin:     user.IsAdmin,
		Permissions: user.Permissions,
		DeviceType:  deviceType,
		Trusted:     !isDemoToken,
		Purpose:     "User Session",
		IsDemoToken: isDemoToken,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.config.Security.JWTSecret,
			Audience:  []string{"universal-ai-tools-api"},
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(now.Add(s.config.Security.JWTExpiration)),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        tokenID,
		},
	}
}
