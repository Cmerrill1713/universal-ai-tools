//! FFI bridge for TypeScript integration

use crate::{IntelligentParameterService, ServiceConfig};
use crate::types::*;
use crate::error::Result;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;

/// FFI-safe wrapper for intelligent parameter service
pub struct ParameterServiceFFI {
    service: Option<Box<IntelligentParameterService>>,
}

/// Create a new parameter service
#[no_mangle]
pub extern "C" fn parameter_service_new(
    enable_ml: bool,
    learning_rate: f64,
    exploration_rate: f64,
    cache_ttl: u64,
    max_history: usize,
    redis_url: *const c_char,
) -> *mut ParameterServiceFFI {
    let redis_url = if redis_url.is_null() {
        None
    } else {
        unsafe {
            CStr::from_ptr(redis_url)
                .to_str()
                .ok()
                .map(|s| s.to_string())
        }
    };
    
    let config = ServiceConfig {
        enable_ml_optimization: enable_ml,
        learning_rate,
        exploration_rate,
        cache_ttl_seconds: cache_ttl,
        max_history_size: max_history,
        enable_reinforcement_learning: false,
        redis_url,
    };
    
    let runtime = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(_) => return ptr::null_mut(),
    };
    
    let service = runtime.block_on(async {
        IntelligentParameterService::new(config).await.ok()
    });
    
    if let Some(service) = service {
        Box::into_raw(Box::new(ParameterServiceFFI {
            service: Some(Box::new(service)),
        }))
    } else {
        ptr::null_mut()
    }
}

/// Get optimal parameters
#[no_mangle]
pub extern "C" fn parameter_service_optimize(
    service: *mut ParameterServiceFFI,
    request_json: *const c_char,
) -> *mut c_char {
    if service.is_null() || request_json.is_null() {
        return ptr::null_mut();
    }
    
    let service = unsafe { &mut *service };
    let c_str = unsafe { CStr::from_ptr(request_json) };
    
    let request_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return ptr::null_mut(),
    };
    
    let request: ParameterRequest = match serde_json::from_str(request_str) {
        Ok(r) => r,
        Err(_) => return ptr::null_mut(),
    };
    
    if let Some(ref service_box) = service.service {
        let runtime = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(_) => return ptr::null_mut(),
        };
        
        let result = runtime.block_on(async {
            service_box.get_optimal_parameters(request).await
        });
        
        match result {
            Ok(params) => {
                match serde_json::to_string(&params) {
                    Ok(json) => match CString::new(json) {
                        Ok(c_string) => c_string.into_raw(),
                        Err(_) => ptr::null_mut(),
                    },
                    Err(_) => ptr::null_mut(),
                }
            }
            Err(_) => ptr::null_mut(),
        }
    } else {
        ptr::null_mut()
    }
}

/// Record performance feedback
#[no_mangle]
pub extern "C" fn parameter_service_feedback(
    service: *mut ParameterServiceFFI,
    feedback_json: *const c_char,
) -> bool {
    if service.is_null() || feedback_json.is_null() {
        return false;
    }
    
    let service = unsafe { &mut *service };
    let c_str = unsafe { CStr::from_ptr(feedback_json) };
    
    let feedback_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };
    
    let feedback: PerformanceFeedback = match serde_json::from_str(feedback_str) {
        Ok(f) => f,
        Err(_) => return false,
    };
    
    if let Some(ref service_box) = service.service {
        let runtime = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(_) => return false,
        };
        
        runtime.block_on(async {
            service_box.record_feedback(feedback).await.is_ok()
        })
    } else {
        false
    }
}

/// Get analytics
#[no_mangle]
pub extern "C" fn parameter_service_analytics(service: *mut ParameterServiceFFI) -> *mut c_char {
    if service.is_null() {
        return ptr::null_mut();
    }
    
    let service = unsafe { &*service };
    
    if let Some(ref service_box) = service.service {
        let runtime = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(_) => return ptr::null_mut(),
        };
        
        let analytics = runtime.block_on(async {
            service_box.get_analytics().await
        });
        
        match serde_json::to_string(&analytics) {
            Ok(json) => match CString::new(json) {
                Ok(c_string) => c_string.into_raw(),
                Err(_) => ptr::null_mut(),
            },
            Err(_) => ptr::null_mut(),
        }
    } else {
        ptr::null_mut()
    }
}

/// Free a string
#[no_mangle]
pub extern "C" fn parameter_service_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}

/// Free the service
#[no_mangle]
pub extern "C" fn parameter_service_free(service: *mut ParameterServiceFFI) {
    if !service.is_null() {
        unsafe {
            let _ = Box::from_raw(service);
        }
    }
}