use crate::{
    models::*,
    AuthService, AuthServiceError, UserStore,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    Extension,
};
use chrono::Utc;
use std::sync::{Arc, atomic::{AtomicU64, Ordering}};
use std::time::Instant;

#[derive(Clone)]
pub struct AppState {
    pub auth_service: AuthService,
    pub user_store: UserStore,
    pub start_time: Instant,
    pub request_counter: Arc<AtomicU64>,
}

impl AppState {
    pub fn new(jwt_secret: String) -> Self {
        Self {
            auth_service: AuthService::new(jwt_secret),
            user_store: UserStore::new(),
            start_time: Instant::now(),
            request_counter: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn increment_requests(&self) {
        self.request_counter.fetch_add(1, Ordering::Relaxed);
    }

    pub fn get_request_count(&self) -> u64 {
        self.request_counter.load(Ordering::Relaxed)
    }
}

/// Health check endpoint
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    state.increment_requests();
    
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "rust-auth-service".to_string(),
        timestamp: Utc::now().timestamp(),
        uptime_seconds: state.start_time.elapsed().as_secs(),
        active_users: state.user_store.active_user_count(),
        total_requests: state.get_request_count(),
    })
}

/// Login endpoint
pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    state.increment_requests();

    // Validate input
    state.auth_service.validate_credentials(&req.username, &req.password)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Get user from store
    let user = state.user_store.get_user_by_username(&req.username)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Check if user is active
    if !user.active {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify password
    let password_valid = state.auth_service.verify_password(&req.password, &user.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !password_valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Generate token
    let token = state.auth_service.generate_token(&user)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let expires_at = Utc::now() + chrono::Duration::hours(24);

    Ok(Json(AuthResponse {
        token,
        user,
        expires_at,
    }))
}

/// Register endpoint
pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    state.increment_requests();

    // Validate input
    state.auth_service.validate_credentials(&req.username, &req.password)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    
    state.auth_service.validate_email(&req.email)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Hash password
    let password_hash = state.auth_service.hash_password(&req.password)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Create user
    let mut user = state.user_store.create_user(req.username, req.email, password_hash)
        .map_err(|e| match e {
            AuthServiceError::UserAlreadyExists { .. } => StatusCode::CONFLICT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })?;

    // Add metadata if provided
    if let Some(metadata) = req.metadata {
        user.metadata = metadata;
    }

    // Generate token
    let token = state.auth_service.generate_token(&user)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let expires_at = Utc::now() + chrono::Duration::hours(24);

    Ok(Json(AuthResponse {
        token,
        user,
        expires_at,
    }))
}

/// Token verification endpoint
pub async fn verify_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Json<TokenValidationResponse> {
    state.increment_requests();

    Json(TokenValidationResponse {
        valid: true,
        user_id: Some(claims.sub.clone()),
        expires_at: Some(chrono::DateTime::from_timestamp(claims.exp, 0).unwrap_or(Utc::now())),
        roles: claims.roles.clone(),
    })
}

/// Get current user profile
pub async fn get_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<User>, StatusCode> {
    state.increment_requests();

    let user = state.user_store.get_user_by_id(&claims.sub)
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(user))
}

/// Update user profile
pub async fn update_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<UserUpdateRequest>,
) -> Result<Json<User>, StatusCode> {
    state.increment_requests();

    // Validate email if provided
    if let Some(ref email) = req.email {
        state.auth_service.validate_email(email)
            .map_err(|_| StatusCode::BAD_REQUEST)?;
    }

    let user = state.user_store.update_user(&claims.sub, req)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(user))
}

/// List all users (admin only)
pub async fn list_users(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<User>>, StatusCode> {
    state.increment_requests();

    // Check admin permission
    state.auth_service.check_admin(&claims)
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let users = state.user_store.list_users();
    Ok(Json(users))
}

/// Get user by ID (admin only)
pub async fn get_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<String>,
) -> Result<Json<User>, StatusCode> {
    state.increment_requests();

    // Check admin permission or own user
    if claims.sub != user_id {
        state.auth_service.check_admin(&claims)
            .map_err(|_| StatusCode::FORBIDDEN)?;
    }

    let user = state.user_store.get_user_by_id(&user_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(user))
}

/// Update user (admin only)
pub async fn update_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<String>,
    Json(req): Json<UserUpdateRequest>,
) -> Result<Json<User>, StatusCode> {
    state.increment_requests();

    // Check admin permission
    state.auth_service.check_admin(&claims)
        .map_err(|_| StatusCode::FORBIDDEN)?;

    // Validate email if provided
    if let Some(ref email) = req.email {
        state.auth_service.validate_email(email)
            .map_err(|_| StatusCode::BAD_REQUEST)?;
    }

    let user = state.user_store.update_user(&user_id, req)
        .map_err(|e| match e {
            AuthServiceError::UserNotFound { .. } => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })?;

    Ok(Json(user))
}

/// Delete user (admin only)
pub async fn delete_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    state.increment_requests();

    // Check admin permission
    state.auth_service.check_admin(&claims)
        .map_err(|_| StatusCode::FORBIDDEN)?;

    // Prevent self-deletion
    if claims.sub == user_id {
        return Err(StatusCode::BAD_REQUEST);
    }

    state.user_store.delete_user(&user_id)
        .map_err(|e| match e {
            AuthServiceError::UserNotFound { .. } => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })?;

    Ok(StatusCode::NO_CONTENT)
}