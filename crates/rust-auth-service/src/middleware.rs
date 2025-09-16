use crate::{AuthService, AuthServiceError, Claims};
use axum::{
    extract::Request,
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};

/// Extract and validate JWT token from Authorization header
pub async fn auth_middleware(
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = &auth_header[7..];
    
    // For this middleware, we need access to the AuthService
    // In a real implementation, this would be injected via extension
    let auth_service = AuthService::new(
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "default_secret".to_string())
    );

    match auth_service.validate_token(token) {
        Ok(claims) => {
            // Add claims to request extensions
            request.extensions_mut().insert(claims);
            Ok(next.run(request).await)
        }
        Err(_) => Err(StatusCode::UNAUTHORIZED),
    }
}

/// Extract authenticated user claims from request
pub fn extract_claims(request: &Request) -> Result<&Claims, AuthServiceError> {
    request
        .extensions()
        .get::<Claims>()
        .ok_or(AuthServiceError::AuthenticationFailed {
            message: "No authentication claims found".to_string(),
        })
}

/// Require admin role
pub async fn require_admin(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let claims = extract_claims(&request).map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    if !claims.roles.contains(&"admin".to_string()) {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(request).await)
}

/// CORS middleware for development
pub async fn cors_middleware(
    request: Request,
    next: Next,
) -> Response {
    let response = next.run(request).await;
    
    let mut response = response;
    let headers = response.headers_mut();
    
    headers.insert("Access-Control-Allow-Origin", "*".parse().unwrap());
    headers.insert("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS".parse().unwrap());
    headers.insert("Access-Control-Allow-Headers", "Content-Type, Authorization".parse().unwrap());
    
    response
}