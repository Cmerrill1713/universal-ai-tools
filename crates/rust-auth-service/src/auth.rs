use crate::{models::*, AuthServiceError};
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use chrono::Utc;

#[derive(Clone)]
pub struct AuthService {
    jwt_secret: String,
    token_expiry_hours: i64,
}

impl AuthService {
    pub fn new(jwt_secret: String) -> Self {
        Self {
            jwt_secret,
            token_expiry_hours: 24, // Default 24 hours
        }
    }

    pub fn with_expiry(mut self, hours: i64) -> Self {
        self.token_expiry_hours = hours;
        self
    }

    /// Hash a password using bcrypt
    pub fn hash_password(&self, password: &str) -> Result<String, AuthServiceError> {
        hash(password, DEFAULT_COST).map_err(|e| AuthServiceError::ValidationError {
            error: format!("Failed to hash password: {}", e),
        })
    }

    /// Verify a password against its hash
    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AuthServiceError> {
        verify(password, hash).map_err(|e| AuthServiceError::ValidationError {
            error: format!("Failed to verify password: {}", e),
        })
    }

    /// Generate a JWT token for a user
    pub fn generate_token(&self, user: &User) -> Result<String, AuthServiceError> {
        let claims = Claims::new(user, self.token_expiry_hours);
        let header = Header::new(Algorithm::HS256);
        
        encode(
            &header,
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref()),
        )
        .map_err(|e| AuthServiceError::AuthenticationFailed {
            message: format!("Failed to generate token: {}", e),
        })
    }

    /// Validate and decode a JWT token
    pub fn validate_token(&self, token: &str) -> Result<Claims, AuthServiceError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;
        
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &validation,
        )
        .map(|data| data.claims)
        .map_err(|e| match e.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthServiceError::TokenExpired,
            _ => AuthServiceError::InvalidToken,
        })
    }

    /// Check if a token is expired
    pub fn is_token_expired(&self, token: &str) -> bool {
        match self.validate_token(token) {
            Ok(claims) => claims.exp < Utc::now().timestamp(),
            Err(_) => true,
        }
    }

    /// Extract user ID from token without full validation (for logging, etc.)
    pub fn extract_user_id(&self, token: &str) -> Option<String> {
        // Use dangerous validation that skips expiry check for logging purposes
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false;
        validation.validate_nbf = false;
        
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &validation,
        )
        .ok()
        .map(|data| data.claims.sub)
    }

    /// Validate user credentials (without database lookup)
    pub fn validate_credentials(&self, username: &str, password: &str) -> Result<(), AuthServiceError> {
        if username.is_empty() {
            return Err(AuthServiceError::ValidationError {
                error: "Username cannot be empty".to_string(),
            });
        }

        if password.len() < 6 {
            return Err(AuthServiceError::ValidationError {
                error: "Password must be at least 6 characters".to_string(),
            });
        }

        Ok(())
    }

    /// Validate email format
    pub fn validate_email(&self, email: &str) -> Result<(), AuthServiceError> {
        if !email.contains('@') || !email.contains('.') {
            return Err(AuthServiceError::ValidationError {
                error: "Invalid email format".to_string(),
            });
        }
        Ok(())
    }

    /// Generate refresh token (simpler token for refresh purposes)
    pub fn generate_refresh_token(&self, user_id: &str) -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        format!("refresh_{}_{}", user_id, timestamp)
    }

    /// Check if user has required role
    pub fn check_role(&self, claims: &Claims, required_role: &str) -> Result<(), AuthServiceError> {
        if !claims.roles.contains(&required_role.to_string()) {
            return Err(AuthServiceError::PermissionDenied);
        }
        Ok(())
    }

    /// Check if user is admin
    pub fn check_admin(&self, claims: &Claims) -> Result<(), AuthServiceError> {
        self.check_role(claims, "admin")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_auth_service() -> AuthService {
        AuthService::new("test_secret_key".to_string())
    }

    #[test]
    fn test_password_hashing() {
        let auth = test_auth_service();
        let password = "test_password123";
        
        let hash = auth.hash_password(password).unwrap();
        assert!(auth.verify_password(password, &hash).unwrap());
        assert!(!auth.verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_token_generation_and_validation() {
        let auth = test_auth_service();
        let user = User::new(
            "testuser".to_string(),
            "test@example.com".to_string(),
            "hashed_password".to_string(),
        );

        let token = auth.generate_token(&user).unwrap();
        let claims = auth.validate_token(&token).unwrap();

        assert_eq!(claims.sub, user.id);
        assert_eq!(claims.username, user.username);
    }

    #[test]
    fn test_credential_validation() {
        let auth = test_auth_service();
        
        assert!(auth.validate_credentials("user", "password123").is_ok());
        assert!(auth.validate_credentials("", "password").is_err());
        assert!(auth.validate_credentials("user", "123").is_err());
    }

    #[test]
    fn test_email_validation() {
        let auth = test_auth_service();
        
        assert!(auth.validate_email("test@example.com").is_ok());
        assert!(auth.validate_email("invalid").is_err());
        assert!(auth.validate_email("test@").is_err());
    }
}