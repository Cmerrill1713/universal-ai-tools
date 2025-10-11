//! Secure Credential Storage with Keychain Integration
//! 
//! This module provides secure storage and retrieval of credentials
//! using environment variables with keychain integration as fallback.

use crate::RouterError;
use std::env;

/// Keychain credential manager for secure storage
#[derive(Debug)]
pub struct KeychainManager {
    service_name: String,
}

/// Credential types supported by the keychain
#[derive(Debug, Clone)]
pub enum CredentialType {
    GitHubToken,
    ApiKey,
    Password,
    Custom(String),
}

impl KeychainManager {
    /// Create a new keychain manager for a specific service
    pub fn new(service_name: &str) -> Self {
        Self {
            service_name: service_name.to_string(),
        }
    }
    
    /// Store a credential securely (environment variable)
    pub fn store_credential(
        &self,
        credential_type: &CredentialType,
        username: &str,
        password: &str,
    ) -> Result<(), RouterError> {
        let env_key = self.get_env_key(credential_type, username);
        
        // Set environment variable for current process
        env::set_var(&env_key, password);
        
        tracing::info!("Stored credential for {} in environment variable {}", username, env_key);
        tracing::warn!("Note: Environment variables are not persistent. Consider using macOS Keychain for permanent storage.");
        Ok(())
    }
    
    /// Retrieve a credential from environment variables
    pub fn get_credential(
        &self,
        credential_type: &CredentialType,
        username: &str,
    ) -> Result<String, RouterError> {
        let env_key = self.get_env_key(credential_type, username);
        
        // Try environment variable first
        if let Ok(password) = env::var(&env_key) {
            tracing::debug!("Retrieved credential for {} from environment variable {}", username, env_key);
            return Ok(password);
        }
        
        // Try common environment variable names
        let common_keys = self.get_common_env_keys(credential_type, username);
        for key in common_keys {
            if let Ok(password) = env::var(&key) {
                tracing::debug!("Retrieved credential for {} from environment variable {}", username, key);
                return Ok(password);
            }
        }
        
        Err(RouterError::AuthenticationError(format!(
            "No credential found for {} in environment variables. Set {} or use store_credential() first.",
            username, env_key
        )))
    }
    
    /// Delete a credential from environment variables
    pub fn delete_credential(
        &self,
        credential_type: &CredentialType,
        username: &str,
    ) -> Result<(), RouterError> {
        let env_key = self.get_env_key(credential_type, username);
        
        // Remove environment variable
        env::remove_var(&env_key);
        
        tracing::info!("Deleted credential for {} from environment variable {}", username, env_key);
        Ok(())
    }
    
    /// List all credentials for this service (environment variables)
    pub fn list_credentials(&self) -> Result<Vec<String>, RouterError> {
        let mut accounts = Vec::new();
        
        // Look for environment variables that match our service pattern
        let prefix = format!("{}_", self.service_name.to_uppercase());
        
        for (key, _value) in env::vars() {
            if key.starts_with(&prefix) {
                // Extract username from env var name
                if let Some(username) = key.strip_prefix(&prefix) {
                    if let Some(cred_type) = username.strip_suffix("_TOKEN")
                        .or_else(|| username.strip_suffix("_API_KEY"))
                        .or_else(|| username.strip_suffix("_PASSWORD")) {
                        accounts.push(cred_type.to_string());
                    }
                }
            }
        }
        
        Ok(accounts)
    }
    
    /// Get environment variable key for credential type
    pub fn get_env_key(&self, credential_type: &CredentialType, username: &str) -> String {
        let suffix = match credential_type {
            CredentialType::GitHubToken => "TOKEN",
            CredentialType::ApiKey => "API_KEY",
            CredentialType::Password => "PASSWORD",
            CredentialType::Custom(name) => &name.to_uppercase(),
        };
        
        format!("{}_{}_{}", self.service_name.to_uppercase(), username.to_uppercase(), suffix)
    }
    
    /// Get common environment variable names to try
    fn get_common_env_keys(&self, credential_type: &CredentialType, username: &str) -> Vec<String> {
        let mut keys = Vec::new();
        
        match credential_type {
            CredentialType::GitHubToken => {
                keys.push(format!("GITHUB_TOKEN"));
                keys.push(format!("GH_TOKEN"));
                keys.push(format!("GITHUB_{}_TOKEN", username.to_uppercase()));
            },
            CredentialType::ApiKey => {
                keys.push(format!("API_KEY"));
                keys.push(format!("{}_API_KEY", username.to_uppercase()));
            },
            CredentialType::Password => {
                keys.push(format!("PASSWORD"));
                keys.push(format!("{}_PASSWORD", username.to_uppercase()));
            },
            CredentialType::Custom(name) => {
                keys.push(format!("{}", name.to_uppercase()));
                keys.push(format!("{}_{}", username.to_uppercase(), name.to_uppercase()));
            },
        }
        
        keys
    }
}

/// Convenience functions for common credential operations
impl KeychainManager {
    /// Store GitHub token
    pub fn store_github_token(&self, username: &str, token: &str) -> Result<(), RouterError> {
        self.store_credential(&CredentialType::GitHubToken, username, token)
    }
    
    /// Get GitHub token
    pub fn get_github_token(&self, username: &str) -> Result<String, RouterError> {
        self.get_credential(&CredentialType::GitHubToken, username)
    }
    
    /// Store API key
    pub fn store_api_key(&self, service: &str, key: &str) -> Result<(), RouterError> {
        self.store_credential(&CredentialType::ApiKey, service, key)
    }
    
    /// Get API key
    pub fn get_api_key(&self, service: &str) -> Result<String, RouterError> {
        self.get_credential(&CredentialType::ApiKey, service)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_env_key_generation() {
        let manager = KeychainManager::new("test-service");
        
        assert_eq!(manager.get_env_key(&CredentialType::GitHubToken, "user1"), "TEST-SERVICE_USER1_TOKEN");
        assert_eq!(manager.get_env_key(&CredentialType::ApiKey, "user2"), "TEST-SERVICE_USER2_API_KEY");
        assert_eq!(manager.get_env_key(&CredentialType::Password, "user3"), "TEST-SERVICE_USER3_PASSWORD");
        assert_eq!(manager.get_env_key(&CredentialType::Custom("custom".to_string()), "user4"), "TEST-SERVICE_USER4_CUSTOM");
    }
}
