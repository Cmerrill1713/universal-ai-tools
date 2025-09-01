//! FFI (Foreign Function Interface) bridge for TypeScript integration
//! 
//! Provides C-compatible interface for seamless integration with the Universal AI Tools Node.js backend

use crate::types::*;

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::ptr;
use tokio::runtime::Runtime;
use serde_json;
use uuid::Uuid;
use tracing::{info, error};

// Simplified FFI approach - create engines per request rather than global storage
static mut RUNTIME: Option<Runtime> = None;

/// Initialize the Parameter Analytics FFI bridge
#[no_mangle]
pub unsafe extern "C" fn parameter_analytics_init() -> c_int {
    // Initialize logging if not already done
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .try_init();

    info!("🚀 Initializing Parameter Analytics FFI Bridge");
    
    // Create Tokio runtime
    match Runtime::new() {
        Ok(runtime) => {
            RUNTIME = Some(runtime);
            info!("✅ Parameter Analytics FFI Bridge initialized successfully");
            1 // Success
        }
        Err(e) => {
            error!("Failed to create Tokio runtime: {}", e);
            0 // Failure
        }
    }
}

/// Create a test execution for benchmarking
#[no_mangle]
pub unsafe extern "C" fn parameter_analytics_create_test_execution(
    result_out: *mut *mut c_char,
) -> c_int {
    let test_execution = ParameterExecution {
        id: Uuid::new_v4(),
        task_type: TaskType::CodeGeneration,
        user_input: "Test execution for FFI validation".to_string(),
        parameters: TaskParameters::default(),
        model: "test-model".to_string(),
        provider: "test-provider".to_string(),
        user_id: Some("test-user".to_string()),
        request_id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now(),
        execution_time: 1000,
        token_usage: TokenUsage {
            prompt_tokens: 100,
            completion_tokens: 200,
            total_tokens: 300,
        },
        response_length: 500,
        response_quality: Some(0.8),
        user_satisfaction: Some(4.0),
        success: true,
        error_type: None,
        retry_count: 0,
        complexity: Complexity::Medium,
        domain: Some("testing".to_string()),
        endpoint: "/test".to_string(),
    };

    match serde_json::to_string(&test_execution) {
        Ok(json_str) => {
            let c_str = CString::new(json_str).unwrap();
            *result_out = c_str.into_raw();
            1
        }
        Err(_) => 0,
    }
}

/// Process a parameter execution (simplified for testing)
#[no_mangle]
pub unsafe extern "C" fn parameter_analytics_process_execution_simple(
    execution_json: *const c_char,
    result_out: *mut *mut c_char,
) -> c_int {
    if RUNTIME.is_none() {
        error!("FFI bridge not initialized");
        return 0;
    }
    
    let execution_str = match CStr::from_ptr(execution_json).to_str() {
        Ok(s) => s,
        Err(_) => return 0,
    };
    
    let _execution: ParameterExecution = match serde_json::from_str(execution_str) {
        Ok(e) => e,
        Err(e) => {
            error!("Failed to parse execution JSON: {}", e);
            return 0;
        }
    };

    // Simplified processing - just return success result
    let result = ExecutionResult {
        processed: true,
        execution_id: Uuid::new_v4(),
        processing_time: 1000, // 1ms
        insights_generated: 0,
        trends_updated: 1,
    };

    match serde_json::to_string(&result) {
        Ok(json_str) => {
            let c_str = CString::new(json_str).unwrap();
            *result_out = c_str.into_raw();
            1
        }
        Err(_) => 0,
    }
}

/// Get service health (simplified)
#[no_mangle]
pub unsafe extern "C" fn parameter_analytics_health_check_simple(
    result_out: *mut *mut c_char,
) -> c_int {
    let health = HealthStatus {
        healthy: RUNTIME.is_some(),
        status: if RUNTIME.is_some() { "operational".to_string() } else { "error".to_string() },
        service: "parameter-analytics-service".to_string(),
        version: "0.1.0".to_string(),
        timestamp: chrono::Utc::now(),
        cache_connected: false, // Simplified for testing
        database_connected: false,
        processing_queue_size: 0,
        total_processed: 0,
    };

    match serde_json::to_string(&health) {
        Ok(json_str) => {
            let c_str = CString::new(json_str).unwrap();
            *result_out = c_str.into_raw();
            1
        }
        Err(_) => 0,
    }
}

/// Run performance test
#[no_mangle]
pub unsafe extern "C" fn parameter_analytics_performance_test_simple(
    operations: c_int,
    result_out: *mut *mut c_char,
) -> c_int {
    if RUNTIME.is_none() {
        return 0;
    }

    let start_time = std::time::Instant::now();
    
    // Simulate processing
    for _i in 0..operations {
        // Simulate some work
        let _sum: u64 = (0..1000).sum();
    }
    
    let duration = start_time.elapsed();
    let throughput = operations as f64 / duration.as_secs_f64();

    let result = PerformanceTestResult {
        test_type: "simple".to_string(),
        operations_completed: operations as u64,
        total_operations: operations as u64,
        duration_ms: duration.as_millis() as u64,
        throughput_ops_per_sec: throughput,
        avg_latency_ms: duration.as_millis() as f64 / operations as f64,
        success_rate: 1.0,
        timestamp: chrono::Utc::now(),
    };

    match serde_json::to_string(&result) {
        Ok(json_str) => {
            let c_str = CString::new(json_str).unwrap();
            *result_out = c_str.into_raw();
            1
        }
        Err(_) => 0,
    }
}

/// Free memory allocated for results
#[no_mangle]
pub unsafe extern "C" fn parameter_analytics_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        let _ = CString::from_raw(ptr);
    }
}

/// Get service version information
#[no_mangle]
pub unsafe extern "C" fn parameter_analytics_version() -> *mut c_char {
    let version_info = serde_json::json!({
        "service": "parameter-analytics-service",
        "version": "0.1.0",
        "build_time": "2025-08-31T12:00:00Z",
        "rust_version": "1.75.0"
    });
    
    match serde_json::to_string(&version_info) {
        Ok(json_str) => {
            match CString::new(json_str) {
                Ok(c_str) => c_str.into_raw(),
                Err(_) => ptr::null_mut(),
            }
        }
        Err(_) => ptr::null_mut(),
    }
}

// Helper types for FFI
#[derive(serde::Serialize)]
struct PerformanceTestResult {
    test_type: String,
    operations_completed: u64,
    total_operations: u64,
    duration_ms: u64,
    throughput_ops_per_sec: f64,
    avg_latency_ms: f64,
    success_rate: f64,
    timestamp: chrono::DateTime<chrono::Utc>,
}