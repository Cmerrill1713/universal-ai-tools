use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    pub active: bool,
    pub roles: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TokenValidationResponse {
    pub valid: bool,
    pub user_id: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub roles: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Claims {
    pub sub: String, // User ID
    pub username: String,
    pub roles: Vec<String>,
    pub exp: i64, // Expiration timestamp
    pub iat: i64, // Issued at timestamp
}

impl Claims {
    pub fn new(user: &User, expires_in_hours: i64) -> Self {
        let now = Utc::now();
        let exp = now.timestamp() + (expires_in_hours * 3600);
        
        Self {
            sub: user.id.clone(),
            username: user.username.clone(),
            roles: user.roles.clone(),
            exp,
            iat: now.timestamp(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub timestamp: i64,
    pub uptime_seconds: u64,
    pub active_users: usize,
    pub total_requests: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserUpdateRequest {
    pub email: Option<String>,
    pub active: Option<bool>,
    pub roles: Option<Vec<String>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

impl User {
    pub fn new(username: String, email: String, password_hash: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            username,
            email,
            password_hash,
            created: now,
            updated: now,
            active: true,
            roles: vec!["user".to_string()],
            metadata: HashMap::new(),
        }
    }

    pub fn is_admin(&self) -> bool {
        self.roles.contains(&"admin".to_string())
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.roles.contains(&role.to_string())
    }
}

// For JWT serialization
impl Serialize for Claims {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("Claims", 5)?;
        state.serialize_field("sub", &self.sub)?;
        state.serialize_field("username", &self.username)?;
        state.serialize_field("roles", &self.roles)?;
        state.serialize_field("exp", &self.exp)?;
        state.serialize_field("iat", &self.iat)?;
        state.end()
    }
}

impl<'de> Deserialize<'de> for Claims {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct ClaimsHelper {
            sub: String,
            username: String,
            roles: Vec<String>,
            exp: i64,
            iat: i64,
        }

        let helper = ClaimsHelper::deserialize(deserializer)?;
        Ok(Claims {
            sub: helper.sub,
            username: helper.username,
            roles: helper.roles,
            exp: helper.exp,
            iat: helper.iat,
        })
    }
}