use crate::cache::CacheManager;
use crate::types::SessionData;
use crate::RedisServiceError;
use chrono::{DateTime, Duration, Utc};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration as StdDuration;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

pub struct SessionManager {
    cache_manager: Arc<CacheManager>,
    default_ttl: StdDuration,
    active_sessions: Arc<RwLock<HashMap<String, DateTime<Utc>>>>,
    cleanup_interval: StdDuration,
}

impl SessionManager {
    pub fn new(cache_manager: Arc<CacheManager>, default_ttl: StdDuration) -> Self {
        Self {
            cache_manager,
            default_ttl,
            active_sessions: Arc::new(RwLock::new(HashMap::new())),
            cleanup_interval: StdDuration::from_secs(300), // 5 minutes
        }
    }

    pub async fn create_session(
        &self,
        session_id: String,
        user_id: Option<String>,
        ttl: Option<StdDuration>,
    ) -> Result<SessionData, RedisServiceError> {
        let ttl_duration = ttl.unwrap_or(self.default_ttl);
        let mut session = SessionData::new(session_id.clone(), ttl_duration);
        
        if let Some(uid) = user_id {
            session.user_id = Some(uid);
        }
        
        let session_key = format!("session:{}", session_id);
        self.cache_manager.set(&session_key, &session, Some(ttl_duration)).await?;
        
        // Track active session
        let mut active = self.active_sessions.write().await;
        active.insert(session_id.clone(), session.expires_at);
        
        info!("Created session: {}", session_id);
        Ok(session)
    }

    pub async fn get_session(&self, session_id: &str) -> Result<Option<SessionData>, RedisServiceError> {
        let session_key = format!("session:{}", session_id);
        
        match self.cache_manager.get::<SessionData>(&session_key).await? {
            Some(session) => {
                if session.is_expired() {
                    debug!("Session {} has expired", session_id);
                    self.delete_session(session_id).await?;
                    Ok(None)
                } else {
                    // Update last accessed time
                    let mut updated_session = session.clone();
                    updated_session.touch();
                    
                    let ttl = updated_session.expires_at - Utc::now();
                    let ttl_duration = StdDuration::from_secs(ttl.num_seconds().max(0) as u64);
                    
                    self.cache_manager.set(&session_key, &updated_session, Some(ttl_duration)).await?;
                    
                    Ok(Some(updated_session))
                }
            }
            None => Ok(None),
        }
    }

    pub async fn update_session(
        &self,
        session_id: &str,
        key: String,
        value: JsonValue,
    ) -> Result<(), RedisServiceError> {
        let session_key = format!("session:{}", session_id);
        
        match self.get_session(session_id).await? {
            Some(mut session) => {
                let key_copy = key.clone();
                session.set(key, value);
                
                let ttl = session.expires_at - Utc::now();
                let ttl_duration = StdDuration::from_secs(ttl.num_seconds().max(0) as u64);
                
                self.cache_manager.set(&session_key, &session, Some(ttl_duration)).await?;
                
                debug!("Updated session {} with key {}", session_id, key_copy);
                Ok(())
            }
            None => Err(RedisServiceError::SessionError {
                error: format!("Session {} not found", session_id),
            }),
        }
    }

    pub async fn delete_session(&self, session_id: &str) -> Result<bool, RedisServiceError> {
        let session_key = format!("session:{}", session_id);
        
        // Remove from active sessions
        let mut active = self.active_sessions.write().await;
        active.remove(session_id);
        
        let deleted = self.cache_manager.delete(&session_key).await?;
        
        if deleted {
            info!("Deleted session: {}", session_id);
        }
        
        Ok(deleted)
    }

    pub async fn extend_session(
        &self,
        session_id: &str,
        additional_ttl: StdDuration,
    ) -> Result<(), RedisServiceError> {
        match self.get_session(session_id).await? {
            Some(mut session) => {
                let new_expiry = session.expires_at + Duration::from_std(additional_ttl)
                    .map_err(|e| RedisServiceError::SessionError {
                        error: format!("Invalid TTL duration: {}", e),
                    })?;
                
                session.expires_at = new_expiry;
                session.touch();
                
                let session_key = format!("session:{}", session_id);
                let ttl = session.expires_at - Utc::now();
                let ttl_duration = StdDuration::from_secs(ttl.num_seconds().max(0) as u64);
                
                self.cache_manager.set(&session_key, &session, Some(ttl_duration)).await?;
                
                // Update active sessions
                let mut active = self.active_sessions.write().await;
                active.insert(session_id.to_string(), new_expiry);
                
                info!("Extended session {} by {:?}", session_id, additional_ttl);
                Ok(())
            }
            None => Err(RedisServiceError::SessionError {
                error: format!("Session {} not found", session_id),
            }),
        }
    }

    pub async fn list_active_sessions(&self) -> Vec<String> {
        let active = self.active_sessions.read().await;
        active.keys().cloned().collect()
    }

    pub async fn cleanup_expired_sessions(&self) -> Result<u32, RedisServiceError> {
        let now = Utc::now();
        let mut expired_count = 0;
        
        let sessions_to_check: Vec<String> = {
            let active = self.active_sessions.read().await;
            active.iter()
                .filter(|(_, expires_at)| **expires_at <= now)
                .map(|(id, _)| id.clone())
                .collect()
        };
        
        for session_id in sessions_to_check {
            if self.delete_session(&session_id).await? {
                expired_count += 1;
            }
        }
        
        if expired_count > 0 {
            info!("Cleaned up {} expired sessions", expired_count);
        }
        
        Ok(expired_count)
    }

    pub async fn start_cleanup_task(self: Arc<Self>) {
        let cleanup_interval = self.cleanup_interval;
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(cleanup_interval);
            
            loop {
                interval.tick().await;
                
                match self.cleanup_expired_sessions().await {
                    Ok(count) => {
                        if count > 0 {
                            debug!("Cleaned up {} expired sessions", count);
                        }
                    }
                    Err(e) => {
                        warn!("Error during session cleanup: {}", e);
                    }
                }
            }
        });
        
        info!("Session cleanup task started (interval: {:?})", cleanup_interval);
    }

    pub async fn get_session_count(&self) -> usize {
        self.active_sessions.read().await.len()
    }

    pub async fn set_user_id(&self, session_id: &str, user_id: String) -> Result<(), RedisServiceError> {
        match self.get_session(session_id).await? {
            Some(mut session) => {
                session.user_id = Some(user_id.clone());
                session.touch();
                
                let session_key = format!("session:{}", session_id);
                let ttl = session.expires_at - Utc::now();
                let ttl_duration = StdDuration::from_secs(ttl.num_seconds().max(0) as u64);
                
                self.cache_manager.set(&session_key, &session, Some(ttl_duration)).await?;
                
                info!("Set user_id {} for session {}", user_id, session_id);
                Ok(())
            }
            None => Err(RedisServiceError::SessionError {
                error: format!("Session {} not found", session_id),
            }),
        }
    }

    pub async fn get_user_sessions(&self, user_id: &str) -> Result<Vec<SessionData>, RedisServiceError> {
        let mut user_sessions = Vec::new();
        
        let active_session_ids: Vec<String> = {
            let active = self.active_sessions.read().await;
            active.keys().cloned().collect()
        };
        
        for session_id in active_session_ids {
            if let Some(session) = self.get_session(&session_id).await? {
                if session.user_id.as_deref() == Some(user_id) {
                    user_sessions.push(session);
                }
            }
        }
        
        Ok(user_sessions)
    }

    pub async fn invalidate_user_sessions(&self, user_id: &str) -> Result<u32, RedisServiceError> {
        let user_sessions = self.get_user_sessions(user_id).await?;
        let mut invalidated_count = 0;
        
        for session in user_sessions {
            if self.delete_session(&session.session_id).await? {
                invalidated_count += 1;
            }
        }
        
        if invalidated_count > 0 {
            info!("Invalidated {} sessions for user {}", invalidated_count, user_id);
        }
        
        Ok(invalidated_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::CacheConfig;

    async fn create_test_manager() -> Arc<SessionManager> {
        let cache_manager = Arc::new(
            CacheManager::new(None, CacheConfig::default())
                .await
                .unwrap()
        );
        
        Arc::new(SessionManager::new(
            cache_manager,
            StdDuration::from_secs(3600),
        ))
    }

    #[tokio::test]
    async fn test_session_lifecycle() {
        let manager = create_test_manager().await;
        
        // Create session
        let session = manager.create_session(
            "test-session".to_string(),
            Some("user123".to_string()),
            None,
        ).await.unwrap();
        
        assert_eq!(session.session_id, "test-session");
        assert_eq!(session.user_id, Some("user123".to_string()));
        
        // Get session
        let retrieved = manager.get_session("test-session").await.unwrap();
        assert!(retrieved.is_some());
        
        // Update session
        manager.update_session(
            "test-session",
            "key1".to_string(),
            serde_json::json!("value1"),
        ).await.unwrap();
        
        // Delete session
        let deleted = manager.delete_session("test-session").await.unwrap();
        assert!(deleted);
        
        // Verify deletion
        let retrieved = manager.get_session("test-session").await.unwrap();
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_session_expiration() {
        let manager = create_test_manager().await;
        
        // Create session with short TTL
        let _ = manager.create_session(
            "short-session".to_string(),
            None,
            Some(StdDuration::from_millis(100)),
        ).await.unwrap();
        
        // Wait for expiration
        tokio::time::sleep(StdDuration::from_millis(200)).await;
        
        // Session should be expired
        let retrieved = manager.get_session("short-session").await.unwrap();
        assert!(retrieved.is_none());
    }
}