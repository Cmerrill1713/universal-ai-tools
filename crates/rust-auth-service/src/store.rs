use crate::{models::*, AuthServiceError};
use dashmap::DashMap;
use std::sync::Arc;
use chrono::Utc;

/// In-memory user store for development/testing
/// In production, this would be replaced with database implementation
#[derive(Clone)]
pub struct UserStore {
    users: Arc<DashMap<String, User>>, // username -> User
    users_by_id: Arc<DashMap<String, String>>, // user_id -> username
}

impl UserStore {
    pub fn new() -> Self {
        let store = Self {
            users: Arc::new(DashMap::new()),
            users_by_id: Arc::new(DashMap::new()),
        };

        // Initialize with test data
        store.init_test_data();
        store
    }

    /// Initialize with some test users for development
    fn init_test_data(&self) {
        let auth_service = crate::auth::AuthService::new("test_secret".to_string());

        let admin_user = User {
            id: "user-001".to_string(),
            username: "admin".to_string(),
            email: "admin@example.com".to_string(),
            password_hash: auth_service.hash_password("password").unwrap(),
            created: Utc::now(),
            updated: Utc::now(),
            active: true,
            roles: vec!["admin".to_string(), "user".to_string()],
            metadata: std::collections::HashMap::new(),
        };

        let test_user = User {
            id: "user-002".to_string(),
            username: "test".to_string(),
            email: "test@example.com".to_string(),
            password_hash: auth_service.hash_password("password").unwrap(),
            created: Utc::now(),
            updated: Utc::now(),
            active: true,
            roles: vec!["user".to_string()],
            metadata: std::collections::HashMap::new(),
        };

        self.users_by_id.insert(admin_user.id.clone(), admin_user.username.clone());
        self.users_by_id.insert(test_user.id.clone(), test_user.username.clone());
        
        self.users.insert(admin_user.username.clone(), admin_user);
        self.users.insert(test_user.username.clone(), test_user);
    }

    /// Create a new user
    pub fn create_user(&self, username: String, email: String, password_hash: String) -> Result<User, AuthServiceError> {
        if self.users.contains_key(&username) {
            return Err(AuthServiceError::UserAlreadyExists { username });
        }

        let user = User::new(username.clone(), email, password_hash);
        self.users_by_id.insert(user.id.clone(), username.clone());
        self.users.insert(username, user.clone());
        
        Ok(user)
    }

    /// Get user by username
    pub fn get_user_by_username(&self, username: &str) -> Option<User> {
        self.users.get(username).map(|entry| entry.clone())
    }

    /// Get user by ID
    pub fn get_user_by_id(&self, user_id: &str) -> Option<User> {
        let username = self.users_by_id.get(user_id)?;
        self.get_user_by_username(&username)
    }

    /// Update user
    pub fn update_user(&self, user_id: &str, updates: UserUpdateRequest) -> Result<User, AuthServiceError> {
        let username = self.users_by_id
            .get(user_id)
            .ok_or_else(|| AuthServiceError::UserNotFound { user_id: user_id.to_string() })?;

        let username = username.clone();
        
        let mut user_entry = self.users
            .get_mut(&username)
            .ok_or_else(|| AuthServiceError::UserNotFound { user_id: user_id.to_string() })?;

        let user = user_entry.value_mut();
        
        if let Some(email) = updates.email {
            user.email = email;
        }
        
        if let Some(active) = updates.active {
            user.active = active;
        }
        
        if let Some(roles) = updates.roles {
            user.roles = roles;
        }
        
        if let Some(metadata) = updates.metadata {
            user.metadata = metadata;
        }
        
        user.updated = Utc::now();
        
        Ok(user.clone())
    }

    /// Delete user
    pub fn delete_user(&self, user_id: &str) -> Result<(), AuthServiceError> {
        let username = self.users_by_id
            .remove(user_id)
            .ok_or_else(|| AuthServiceError::UserNotFound { user_id: user_id.to_string() })?
            .1;

        self.users.remove(&username);
        Ok(())
    }

    /// List all users (for admin)
    pub fn list_users(&self) -> Vec<User> {
        self.users
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Get user count
    pub fn user_count(&self) -> usize {
        self.users.len()
    }

    /// Check if user exists by username
    pub fn user_exists(&self, username: &str) -> bool {
        self.users.contains_key(username)
    }

    /// Get active user count
    pub fn active_user_count(&self) -> usize {
        self.users
            .iter()
            .filter(|entry| entry.value().active)
            .count()
    }
}

impl Default for UserStore {
    fn default() -> Self {
        Self::new()
    }
}