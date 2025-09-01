//! FFI bridge for TypeScript integration

use crate::{MultimodalFusionService, FusionConfig};
use crate::types::*;
use crate::error::Result;
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_void};
use std::ptr;

/// FFI-safe wrapper for multimodal fusion service
pub struct FusionServiceFFI {
    service: Option<Box<MultimodalFusionService>>,
}

/// Create a new fusion service
#[no_mangle]
pub extern "C" fn fusion_service_new(
    window_size: usize,
    overlap_ratio: f32,
    embedding_dim: usize,
    max_active_windows: usize,
    attention_heads: usize,
    hidden_dim: usize,
) -> *mut FusionServiceFFI {
    let config = FusionConfig {
        window_size,
        overlap_ratio,
        embedding_dim,
        max_active_windows,
        attention_heads,
        hidden_dim,
        enable_gpu: false,
    };
    
    // Create runtime for async operations
    let runtime = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(_) => return ptr::null_mut(),
    };
    
    let service = runtime.block_on(async {
        MultimodalFusionService::new(config).await.ok()
    });
    
    if let Some(service) = service {
        Box::into_raw(Box::new(FusionServiceFFI {
            service: Some(Box::new(service)),
        }))
    } else {
        ptr::null_mut()
    }
}

/// Process multimodal input
#[no_mangle]
pub extern "C" fn fusion_service_process(
    service: *mut FusionServiceFFI,
    input_json: *const c_char,
) -> *mut c_char {
    if service.is_null() || input_json.is_null() {
        return ptr::null_mut();
    }
    
    let service = unsafe { &mut *service };
    let c_str = unsafe { CStr::from_ptr(input_json) };
    
    let input_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return ptr::null_mut(),
    };
    
    // Parse input JSON
    let input: ModalityInput = match serde_json::from_str(input_str) {
        Ok(i) => i,
        Err(_) => return ptr::null_mut(),
    };
    
    if let Some(ref service_box) = service.service {
        let runtime = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(_) => return ptr::null_mut(),
        };
        
        let result = runtime.block_on(async {
            service_box.process_multimodal(input).await
        });
        
        match result {
            Ok(fusion_result) => {
                match serde_json::to_string(&fusion_result) {
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

/// Get analytics
#[no_mangle]
pub extern "C" fn fusion_service_analytics(service: *mut FusionServiceFFI) -> *mut c_char {
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

/// Free a string returned by FFI functions
#[no_mangle]
pub extern "C" fn fusion_service_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}

/// Free the fusion service
#[no_mangle]
pub extern "C" fn fusion_service_free(service: *mut FusionServiceFFI) {
    if !service.is_null() {
        unsafe {
            let _ = Box::from_raw(service);
        }
    }
}