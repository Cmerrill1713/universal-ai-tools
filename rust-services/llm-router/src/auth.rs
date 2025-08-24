//! JWT Authentication Module for LLM Router Service
//! Provides middleware for validating JWT tokens and extracting user information

use axum::{
    async_trait,
    extract::{FromRequestParts, State},
    http::{header::AUTHORIZATION, HeaderMap, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, sync::Arc};
use tracing::{error, info, warn};

/// JWT Claims structure matching the TypeScript implementation
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    #[serde(rename = "userId")]
    pub user_id: String,
    pub email: Option<String>,
    #[serde(rename = "isAdmin")]
    pub is_admin: Option<bool>,
    pub permissions: Option<Vec<String>>,
    #[serde(rename = "deviceId")]
    pub device_id: Option<String>,
    #[serde(rename = "deviceType")]
    pub device_type: Option<String>,
    pub trusted: Option<bool>,
    pub iat: Option<u64>, // issued at
    pub exp: Option<u64>, // expiration
    pub iss: Option<String>, // issuer
    pub aud: Option<String>, // audience
    pub jti: Option<String>, // JWT ID
    pub sub: Option<String>, // subject
    #[serde(rename = "isDemoToken")]
    pub is_demo_token: Option<bool>,
}

/// User information extracted from JWT
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub email: Option<String>,
    pub is_admin: bool,
    pub permissions: Vec<String>,
    pub device_id: Option<String>,
    pub device_type: Option<String>,
    pub trusted: bool,
}

impl From<JwtClaims> for AuthenticatedUser {
    fn from(claims: JwtClaims) -> Self {
        Self {
            user_id: claims.user_id,
            email: claims.email,
            is_admin: claims.is_admin.unwrap_or(false),
            permissions: claims.permissions.unwrap_or_default(),
            device_id: claims.device_id,
            device_type: claims.device_type,
            trusted: claims.trusted.unwrap_or(false),
        }
    }
}

/// Authentication configuration
#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub jwt_issuer: String,
    pub jwt_audience: String,
    pub public_endpoints: HashSet<String>,
    pub require_auth: bool,
}

impl Default for AuthConfig {
    fn default() -> Self {
        let mut public_endpoints = HashSet::new();
        public_endpoints.insert("/health".to_string());
        public_endpoints.insert("/metrics".to_string());
        public_endpoints.insert("/status".to_string());
        
        Self {
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "development-secret-key".to_string()),
            jwt_issuer: std::env::var("JWT_ISSUER")
                .unwrap_or_else(|_| "universal-ai-tools".to_string()),
            jwt_audience: std::env::var("JWT_AUDIENCE")
                .unwrap_or_else(|_| "universal-ai-tools-api".to_string()),
            public_endpoints,
            require_auth: std::env::var("REQUIRE_AUTH")
                .map(|v| v.to_lowercase() == "true")
                .unwrap_or(true),
        }
    }
}

/// Authentication state shared across the application
pub type AuthState = Arc<AuthConfig>;

/// JWT Authentication middleware
pub async fn jwt_auth_middleware<B>(
    State(auth_config): State<AuthState>,
    mut request: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    let path = request.uri().path();
    
    // Check if this is a public endpoint
    if auth_config.public_endpoints.contains(path) || !auth_config.require_auth {
        info!("🔓 Public endpoint accessed: {}", path);
        return Ok(next.run(request).await);
    }

    // Extract Authorization header
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            &header[7..] // Remove "Bearer " prefix
        }
        Some(header) => {
            warn!("🔐 Invalid Authorization header format: {}", header);
            return Err(StatusCode::UNAUTHORIZED);
        }
        None => {
            // Check for API key in headers
            let api_key = request
                .headers()
                .get("x-api-key")
                .and_then(|h| h.to_str().ok());
            
            if let Some(key) = api_key {
                if validate_api_key(key).await {
                    info!("🔑 Valid API key authentication");
                    // Insert a minimal user for API key auth
                    request.extensions_mut().insert(AuthenticatedUser {
                        user_id: "api-user".to_string(),
                        email: None,
                        is_admin: false,
                        permissions: vec!["api_access".to_string()],
                        device_id: None,
                        device_type: None,
                        trusted: false,
                    });
                    return Ok(next.run(request).await);
                } else {
                    warn!("🔐 Invalid API key provided");
                    return Err(StatusCode::UNAUTHORIZED);
                }
            }
            
            warn!("🔐 No authentication provided for protected endpoint: {}", path);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Validate JWT token
    match validate_jwt_token(token, &auth_config).await {
        Ok(user) => {
            info!("🔐 JWT authentication successful for user: {}", user.user_id);
            // Insert user into request extensions for downstream handlers
            request.extensions_mut().insert(user);
            Ok(next.run(request).await)
        }
        Err(e) => {
            error!("🔐 JWT authentication failed: {}", e);
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

/// Validate JWT token and extract user information
async fn validate_jwt_token(
    token: &str,
    auth_config: &AuthConfig,
) -> Result<AuthenticatedUser, String> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&[auth_config.jwt_issuer.clone()]);
    validation.set_audience(&[auth_config.jwt_audience.clone()]);
    validation.leeway = 30; // 30 seconds clock skew tolerance

    let decoding_key = DecodingKey::from_secret(auth_config.jwt_secret.as_bytes());

    match decode::<JwtClaims>(token, &decoding_key, &validation) {
        Ok(token_data) => {
            let claims = token_data.claims;
            
            // Additional validation
            if let Some(exp) = claims.exp {
                let now = chrono::Utc::now().timestamp() as u64;
                if exp < now {
                    return Err("Token has expired".to_string());
                }
            }
            
            // Check if it's a demo token in production
            if claims.is_demo_token.unwrap_or(false) && 
               std::env::var("NODE_ENV").unwrap_or_default() == "production" {
                return Err("Demo tokens not allowed in production".to_string());
            }
            
            Ok(AuthenticatedUser::from(claims))
        }
        Err(e) => Err(format!("Invalid JWT token: {}", e)),
    }
}

/// Validate API key (placeholder implementation)
async fn validate_api_key(api_key: &str) -> bool {
    // In a real implementation, this would check against a database or cache
    // For now, we'll check against environment variables or use a simple validation
    let valid_api_keys = std::env::var("VALID_API_KEYS")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim())
        .collect::<Vec<_>>();
    
    !api_key.is_empty() && (
        valid_api_keys.contains(&api_key) ||
        api_key == "development-api-key" // Development fallback
    )
}

/// Extractor for authenticated user from request
#[async_trait]
impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthenticatedUser>()
            .cloned()
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({
                        "error": "Authentication required",
                        "message": "No valid authentication found in request"
                    })),
                )
            })
    }
}

/// Error response for authentication failures
#[derive(Serialize)]
pub struct AuthError {
    pub error: String,
    pub message: String,
    pub status: u16,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (
            StatusCode::from_u16(self.status).unwrap_or(StatusCode::UNAUTHORIZED),
            Json(self),
        )
            .into_response()
    }
}

/// Helper function to create authentication state
pub fn create_auth_state() -> AuthState {
    Arc::new(AuthConfig::default())
}

/// Middleware to require admin permissions
pub async fn require_admin_middleware<B>(
    user: AuthenticatedUser,
    request: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    if !user.is_admin {
        warn!("🔐 Admin access denied for user: {}", user.user_id);
        return Err(StatusCode::FORBIDDEN);
    }
    
    info!("🔐 Admin access granted for user: {}", user.user_id);
    Ok(next.run(request).await)
}

/// Middleware to check specific permission
pub fn require_permission(required_permission: &'static str) -> impl Fn(AuthenticatedUser, Request<axum::body::Body>, Next<axum::body::Body>) -> Result<Response, StatusCode> + Clone {
    move |user: AuthenticatedUser, request: Request<axum::body::Body>, next: Next<axum::body::Body>| async move {
        if !user.permissions.contains(&required_permission.to_string()) {
            warn!("🔐 Permission '{}' denied for user: {}", required_permission, user.user_id);
            return Err(StatusCode::FORBIDDEN);
        }
        
        info!("🔐 Permission '{}' granted for user: {}", required_permission, user.user_id);
        Ok(next.run(request).await)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};
    
    #[tokio::test]
    async fn test_jwt_validation() {
        let auth_config = AuthConfig::default();
        
        // Create a test token
        let claims = JwtClaims {
            user_id: "test-user".to_string(),
            email: Some("test@example.com".to_string()),
            is_admin: Some(false),
            permissions: Some(vec!["read".to_string()]),
            device_id: None,
            device_type: None,
            trusted: Some(true),
            iat: Some(chrono::Utc::now().timestamp() as u64),
            exp: Some((chrono::Utc::now() + chrono::Duration::hours(1)).timestamp() as u64),
            iss: Some(auth_config.jwt_issuer.clone()),
            aud: Some(auth_config.jwt_audience.clone()),
            jti: Some("test-token-id".to_string()),
            sub: Some("test-user".to_string()),
            is_demo_token: Some(false),
        };
        
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(auth_config.jwt_secret.as_bytes()),
        ).unwrap();
        
        let result = validate_jwt_token(&token, &auth_config).await;
        assert!(result.is_ok());
        
        let user = result.unwrap();
        assert_eq!(user.user_id, "test-user");
        assert_eq!(user.email, Some("test@example.com".to_string()));
        assert!(!user.is_admin);
        assert!(user.trusted);
    }
}