//! FFI bindings for integrating AB-MCTS Rust service with TypeScript/Node.js
//! 
//! Provides C-compatible interface for the bridge functionality to enable
//! seamless integration with the Universal AI Tools main system.

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::ptr;
use once_cell::sync::Lazy;
use tokio::runtime::Runtime;
use std::sync::Arc;

use crate::bridge::MCTSBridge;
use crate::engine::MCTSConfig;
use crate::types::*;

// Global runtime for async operations
static RUNTIME: Lazy<Runtime> = Lazy::new(|| {
    Runtime::new().expect("Failed to create Tokio runtime for FFI")
});

// Global bridge instance
static mut BRIDGE_INSTANCE: Option<Arc<MCTSBridge>> = None;

/// Initialize the AB-MCTS service with configuration JSON
/// Returns 0 on success, -1 on error
#[no_mangle]
pub extern "C" fn ab_mcts_initialize(config_json: *const c_char) -> c_int {
    if config_json.is_null() {
        return -1;
    }
    
    let config_str = match unsafe { CStr::from_ptr(config_json) }.to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };
    
    // Parse configuration
    let config: MCTSConfig = match serde_json::from_str(config_str) {
        Ok(c) => c,
        Err(_) => MCTSConfig::default(),
    };
    
    // Initialize bridge
    let bridge_result = RUNTIME.block_on(async {
        let mut bridge = MCTSBridge::with_config(config);
        match bridge.initialize().await {
            Ok(_) => {
                unsafe {
                    BRIDGE_INSTANCE = Some(Arc::new(bridge));
                }
                Ok(())
            }
            Err(_) => Err("Failed to initialize bridge"),
        }
    });
    
    match bridge_result {
        Ok(_) => 0,
        Err(_) => -1,
    }
}

/// Perform optimal agent search
/// Returns JSON result as C string (must be freed with ab_mcts_free_string)
#[no_mangle]
pub extern "C" fn ab_mcts_search_optimal_agents(
    context_json: *const c_char,
    agents_json: *const c_char,
    options_json: *const c_char,
) -> *mut c_char {
    if context_json.is_null() || agents_json.is_null() {
        return ptr::null_mut();
    }
    
    let bridge = unsafe {
        match &BRIDGE_INSTANCE {
            Some(b) => b.clone(),
            None => return ptr::null_mut(),
        }
    };
    
    let result = RUNTIME.block_on(async {
        // Parse inputs
        let context_str = match unsafe { CStr::from_ptr(context_json) }.to_str() {
            Ok(s) => s,
            Err(_) => return None,
        };
        
        let agents_str = match unsafe { CStr::from_ptr(agents_json) }.to_str() {
            Ok(s) => s,
            Err(_) => return None,
        };
        
        let context: AgentContext = match serde_json::from_str(context_str) {
            Ok(c) => c,
            Err(_) => return None,
        };
        
        let agents: Vec<String> = match serde_json::from_str(agents_str) {
            Ok(a) => a,
            Err(_) => return None,
        };
        
        // Parse options if provided
        let options = if !options_json.is_null() {
            let options_str = match unsafe { CStr::from_ptr(options_json) }.to_str() {
                Ok(s) => s,
                Err(_) => return None,
            };
            match serde_json::from_str(options_str) {
                Ok(o) => Some(o),
                Err(_) => None,
            }
        } else {
            None
        };
        
        // Perform search
        match bridge.search_optimal_agents(&context, &agents, options).await {
            Ok(result) => Some(result.to_string()),
            Err(_) => None,
        }
    });
    
    match result {
        Some(json_str) => {
            match CString::new(json_str) {
                Ok(c_str) => c_str.into_raw(),
                Err(_) => ptr::null_mut(),
            }
        }
        None => ptr::null_mut(),
    }
}

/// Get quick agent recommendations
/// Returns JSON result as C string (must be freed with ab_mcts_free_string)
#[no_mangle]
pub extern "C" fn ab_mcts_recommend_agents(
    context_json: *const c_char,
    agents_json: *const c_char,
    max_recommendations: c_int,
) -> *mut c_char {
    if context_json.is_null() || agents_json.is_null() || max_recommendations <= 0 {
        return ptr::null_mut();
    }
    
    let bridge = unsafe {
        match &BRIDGE_INSTANCE {
            Some(b) => b.clone(),
            None => return ptr::null_mut(),
        }
    };
    
    let result = RUNTIME.block_on(async {
        // Parse inputs
        let context_str = match unsafe { CStr::from_ptr(context_json) }.to_str() {
            Ok(s) => s,
            Err(_) => return None,
        };
        
        let agents_str = match unsafe { CStr::from_ptr(agents_json) }.to_str() {
            Ok(s) => s,
            Err(_) => return None,
        };
        
        let context: AgentContext = match serde_json::from_str(context_str) {
            Ok(c) => c,
            Err(_) => return None,
        };
        
        let agents: Vec<String> = match serde_json::from_str(agents_str) {
            Ok(a) => a,
            Err(_) => return None,
        };
        
        // Get recommendations
        match bridge.recommend_agents(&context, &agents, max_recommendations as usize).await {
            Ok(result) => Some(result.to_string()),
            Err(_) => None,
        }
    });
    
    match result {
        Some(json_str) => {
            match CString::new(json_str) {
                Ok(c_str) => c_str.into_raw(),
                Err(_) => ptr::null_mut(),
            }
        }
        None => ptr::null_mut(),
    }
}

/// Update the service with feedback from executed agents
/// Returns 0 on success, -1 on error
#[no_mangle]
pub extern "C" fn ab_mcts_update_feedback(
    session_id: *const c_char,
    agent_name: *const c_char,
    reward_json: *const c_char,
) -> c_int {
    if session_id.is_null() || agent_name.is_null() || reward_json.is_null() {
        return -1;
    }
    
    let bridge = unsafe {
        match &BRIDGE_INSTANCE {
            Some(b) => b.clone(),
            None => return -1,
        }
    };
    
    let result = RUNTIME.block_on(async {
        // Parse inputs
        let session_str = match unsafe { CStr::from_ptr(session_id) }.to_str() {
            Ok(s) => s,
            Err(_) => return false,
        };
        
        let agent_str = match unsafe { CStr::from_ptr(agent_name) }.to_str() {
            Ok(s) => s,
            Err(_) => return false,
        };
        
        let reward_str = match unsafe { CStr::from_ptr(reward_json) }.to_str() {
            Ok(s) => s,
            Err(_) => return false,
        };
        
        let reward: MCTSReward = match serde_json::from_str(reward_str) {
            Ok(r) => r,
            Err(_) => return false,
        };
        
        // Update with feedback
        match bridge.update_with_feedback(session_str, agent_str, &reward).await {
            Ok(_) => true,
            Err(_) => false,
        }
    });
    
    if result { 0 } else { -1 }
}

/// Get performance statistics
/// Returns JSON result as C string (must be freed with ab_mcts_free_string)
#[no_mangle]
pub extern "C" fn ab_mcts_get_performance_stats() -> *mut c_char {
    let bridge = unsafe {
        match &BRIDGE_INSTANCE {
            Some(b) => b.clone(),
            None => return ptr::null_mut(),
        }
    };
    
    let result = RUNTIME.block_on(async {
        match bridge.get_performance_stats().await {
            Ok(stats) => Some(stats.to_string()),
            Err(_) => None,
        }
    });
    
    match result {
        Some(json_str) => {
            match CString::new(json_str) {
                Ok(c_str) => c_str.into_raw(),
                Err(_) => ptr::null_mut(),
            }
        }
        None => ptr::null_mut(),
    }
}

/// Perform health check
/// Returns JSON result as C string (must be freed with ab_mcts_free_string)
#[no_mangle]
pub extern "C" fn ab_mcts_health_check() -> *mut c_char {
    let bridge = unsafe {
        match &BRIDGE_INSTANCE {
            Some(b) => b.clone(),
            None => return ptr::null_mut(),
        }
    };
    
    let result = RUNTIME.block_on(async {
        let health = bridge.health_check().await;
        serde_json::to_string(&health).ok()
    });
    
    match result {
        Some(json_str) => {
            match CString::new(json_str) {
                Ok(c_str) => c_str.into_raw(),
                Err(_) => ptr::null_mut(),
            }
        }
        None => ptr::null_mut(),
    }
}

/// Free a string returned by the AB-MCTS service
#[no_mangle]
pub extern "C" fn ab_mcts_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

/// Shutdown the AB-MCTS service
/// Returns 0 on success, -1 on error
#[no_mangle]
pub extern "C" fn ab_mcts_shutdown() -> c_int {
    unsafe {
        BRIDGE_INSTANCE = None;
    }
    0
}

/// Get service version information
/// Returns version string as C string (must be freed with ab_mcts_free_string)
#[no_mangle]
pub extern "C" fn ab_mcts_get_version() -> *mut c_char {
    let version_info = serde_json::json!({
        "name": "ab-mcts-rust-service",
        "version": env!("CARGO_PKG_VERSION"),
        "build_date": std::env::var("BUILD_DATE").unwrap_or_else(|_| "unknown".to_string()),
        "git_hash": std::env::var("GIT_HASH").unwrap_or_else(|_| "unknown".to_string()),
        "rust_version": std::env::var("RUSTC_VERSION").unwrap_or_else(|_| "1.81.0".to_string())
    });
    
    match CString::new(version_info.to_string()) {
        Ok(c_str) => c_str.into_raw(),
        Err(_) => ptr::null_mut(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::CString;
    
    #[test]
    fn test_ffi_initialization() {
        let config = serde_json::json!({
            "max_iterations": 100,
            "max_depth": 5,
            "exploration_constant": 1.0,
            "discount_factor": 0.9,
            "time_limit": 1000,
            "enable_thompson_sampling": true,
            "enable_bayesian_learning": true,
            "enable_caching": false
        });
        
        let config_str = CString::new(config.to_string()).unwrap();
        let result = ab_mcts_initialize(config_str.as_ptr());
        assert_eq!(result, 0);
        
        // Cleanup
        let shutdown_result = ab_mcts_shutdown();
        assert_eq!(shutdown_result, 0);
    }
    
    #[test]
    fn test_version_info() {
        let version_ptr = ab_mcts_get_version();
        assert!(!version_ptr.is_null());
        
        let version_str = unsafe { CStr::from_ptr(version_ptr) };
        let version_json: serde_json::Value = serde_json::from_str(version_str.to_str().unwrap()).unwrap();
        
        assert_eq!(version_json["name"], "ab-mcts-rust-service");
        assert_eq!(version_json["version"], "0.1.0");
        
        ab_mcts_free_string(version_ptr);
    }
}