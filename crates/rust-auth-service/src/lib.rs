pub mod auth;
pub mod models;
pub mod error;
pub mod handlers;
pub mod middleware;
pub mod store;

// NAPI bridge for Node.js integration
#[cfg(feature = "napi")]
pub mod napi_bridge;

pub use auth::*;
pub use models::*;
pub use error::*;
pub use handlers::*;
pub use middleware::*;
pub use store::*;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum AuthServiceError {
    #[error("Authentication failed: {message}")]
    AuthenticationFailed { message: String },
    #[error("User not found: {user_id}")]
    UserNotFound { user_id: String },
    #[error("User already exists: {username}")]
    UserAlreadyExists { username: String },
    #[error("Invalid token")]
    InvalidToken,
    #[error("Token expired")]
    TokenExpired,
    #[error("Permission denied")]
    PermissionDenied,
    #[error("Database error: {error}")]
    DatabaseError { error: String },
    #[error("Validation error: {error}")]
    ValidationError { error: String },
}