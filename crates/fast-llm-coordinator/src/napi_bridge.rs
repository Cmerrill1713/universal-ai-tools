use crate::{
    coordinator::{CoordinatedExecutionResult, FastLLMCoordinator, MultiAgentCoordinationResult, SystemStatus},
    routing::{CoordinationContext, UrgencyLevel, ResponseLength},
    load_balancer::LoadBalancingStrategy,
};
use napi::{bindgen_prelude::*, JsObject};
use napi_derive::napi;
use serde_json;
use std::collections::HashMap;
use tokio::sync::OnceCell;

static COORDINATOR: OnceCell<FastLLMCoordinator> = OnceCell::const_new();

#[napi(object)]
pub struct JsCoordinationContext {
    pub task_type: String,
    pub complexity: String,
    pub urgency: String,
    pub expected_response_length: String,
    pub requires_creativity: bool,
    pub requires_accuracy: bool,
    pub timestamp: Option<f64>,
}

#[napi(object)]
pub struct JsExecutionResult {
    pub content: String,
    pub model: String,
    pub provider: String,
    pub tokens_used: u32,
    pub execution_time: f64,
    pub confidence: f64,
    pub metadata: String, // JSON string
}

#[napi(object)]
pub struct JsExecutionMetadata {
    pub routing_decision: String, // JSON string
    pub execution_time: f64,
    pub tokens_used: u32,
    pub service_used: String,
    pub was_load_balanced: bool,
    pub confidence: f64,
    pub performance_ratio: Option<f64>,
}

#[napi(object)]
pub struct JsCoordinatedResult {
    pub response: JsExecutionResult,
    pub metadata: JsExecutionMetadata,
}

#[napi(object)]
pub struct JsMultiAgentResult {
    pub primary: JsExecutionResult,
    pub supporting: Vec<JsExecutionResult>,
    pub coordination: String, // JSON string of coordination summary
}

#[napi(object)]
pub struct JsSystemStatus {
    pub fast_models: String, // JSON string
    pub services: String, // JSON string
    pub performance: String, // JSON string
    pub load_balancing: String, // JSON string
    pub resource_metrics: String, // JSON string
}

#[napi(object)]
pub struct JsPerformanceMetrics {
    pub total_requests: f64,
    pub successful_requests: f64,
    pub failed_requests: f64,
    pub average_response_time: f64,
    pub fastest_response_time: f64,
    pub slowest_response_time: f64,
    pub requests_per_second: f64,
    pub error_rate: f64,
    pub service_metrics: String, // JSON string
    pub routing_metrics: String, // JSON string
    pub load_balancing_metrics: String, // JSON string
    pub timestamp: f64,
}

/// Initialize the Fast LLM Coordinator
#[napi]
pub async fn initialize_coordinator(strategy: Option<String>) -> napi::Result<()> {
    let load_balancing_strategy = match strategy.as_deref() {
        Some("weighted_round_robin") => LoadBalancingStrategy::WeightedRoundRobin,
        Some("least_connections") => LoadBalancingStrategy::LeastConnections,
        Some("response_time_based") => LoadBalancingStrategy::ResponseTimeBased,
        _ => LoadBalancingStrategy::Hybrid,
    };
    
    let coordinator = FastLLMCoordinator::with_load_balancing_strategy(load_balancing_strategy);
    
    COORDINATOR.set(coordinator)
        .map_err(|_| napi::Error::from_reason("Coordinator already initialized".to_string()))?;
    
    Ok(())
}

/// Make a routing decision for a given request
#[napi]
pub async fn make_routing_decision(
    user_request: String,
    context: JsCoordinationContext,
) -> napi::Result<String> {
    let coordinator = COORDINATOR.get()
        .ok_or_else(|| napi::Error::from_reason("Coordinator not initialized".to_string()))?;
    
    let coordination_context = convert_js_context(context)?;
    
    let decision = coordinator
        .make_routing_decision(&user_request, &coordination_context)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Routing decision failed: {}", e)))?;
    
    serde_json::to_string(&decision)
        .map_err(|e| napi::Error::from_reason(format!("Serialization failed: {}", e)))
}

/// Execute a request with full coordination
#[napi]
pub async fn execute_with_coordination(
    user_request: String,
    context: JsCoordinationContext,
) -> napi::Result<JsCoordinatedResult> {
    let coordinator = COORDINATOR.get()
        .ok_or_else(|| napi::Error::from_reason("Coordinator not initialized".to_string()))?;
    
    let coordination_context = convert_js_context(context)?;
    
    let result = coordinator
        .execute_with_coordination(&user_request, &coordination_context)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Execution failed: {}", e)))?;
    
    convert_coordinated_result(result)
}

/// Coordinate multiple agents
#[napi]
pub async fn coordinate_multiple_agents(
    primary_task: String,
    supporting_tasks: Vec<String>,
) -> napi::Result<JsMultiAgentResult> {
    let coordinator = COORDINATOR.get()
        .ok_or_else(|| napi::Error::from_reason("Coordinator not initialized".to_string()))?;
    
    let result = coordinator
        .coordinate_multiple_agents(&primary_task, &supporting_tasks)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Multi-agent coordination failed: {}", e)))?;
    
    convert_multi_agent_result(result)
}

/// Get comprehensive system status
#[napi]
pub async fn get_system_status() -> napi::Result<JsSystemStatus> {
    let coordinator = COORDINATOR.get()
        .ok_or_else(|| napi::Error::from_reason("Coordinator not initialized".to_string()))?;
    
    let status = coordinator.get_system_status().await;
    
    convert_system_status(status)
}

/// Get performance metrics
#[napi]
pub fn get_performance_metrics() -> napi::Result<JsPerformanceMetrics> {
    let coordinator = COORDINATOR.get()
        .ok_or_else(|| napi::Error::from_reason("Coordinator not initialized".to_string()))?;
    
    let metrics = coordinator.get_performance_metrics();
    
    convert_performance_metrics(metrics)
}

/// Get service performance comparison
#[napi]
pub fn get_service_performance_comparison() -> napi::Result<String> {
    let coordinator = COORDINATOR.get()
        .ok_or_else(|| napi::Error::from_reason("Coordinator not initialized".to_string()))?;
    
    let comparison = coordinator.get_service_performance_comparison();
    
    serde_json::to_string(&comparison)
        .map_err(|e| napi::Error::from_reason(format!("Serialization failed: {}", e)))
}

/// Quick health check
#[napi]
pub async fn health_check() -> napi::Result<String> {
    let coordinator = COORDINATOR.get()
        .ok_or_else(|| napi::Error::from_reason("Coordinator not initialized".to_string()))?;
    
    let status = coordinator.get_system_status().await;
    let healthy_services = status.resource_metrics.healthy_services;
    let total_services = status.services.len() as u32;
    
    let health_status = serde_json::json!({
        "status": if healthy_services > 0 { "healthy" } else { "degraded" },
        "healthy_services": healthy_services,
        "total_services": total_services,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    Ok(health_status.to_string())
}

// Helper conversion functions

fn convert_js_context(js_context: JsCoordinationContext) -> napi::Result<CoordinationContext> {
    let urgency = match js_context.urgency.to_lowercase().as_str() {
        "low" => UrgencyLevel::Low,
        "medium" => UrgencyLevel::Medium,
        "high" => UrgencyLevel::High,
        _ => UrgencyLevel::Medium,
    };
    
    let expected_response_length = match js_context.expected_response_length.to_lowercase().as_str() {
        "short" => ResponseLength::Short,
        "medium" => ResponseLength::Medium,
        "long" => ResponseLength::Long,
        _ => ResponseLength::Medium,
    };
    
    let timestamp = js_context.timestamp.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as f64
    }) as u64;
    
    Ok(CoordinationContext {
        task_type: js_context.task_type,
        complexity: js_context.complexity,
        urgency,
        expected_response_length,
        requires_creativity: js_context.requires_creativity,
        requires_accuracy: js_context.requires_accuracy,
        timestamp,
    })
}

fn convert_coordinated_result(result: CoordinatedExecutionResult) -> napi::Result<JsCoordinatedResult> {
    let response = JsExecutionResult {
        content: result.response.content,
        model: result.response.model,
        provider: result.response.provider,
        tokens_used: result.response.tokens_used,
        execution_time: result.response.execution_time as f64,
        confidence: result.response.confidence,
        metadata: serde_json::to_string(&result.response.metadata)
            .map_err(|e| napi::Error::from_reason(format!("Metadata serialization failed: {}", e)))?,
    };
    
    let routing_decision_json = serde_json::to_string(&result.metadata.routing_decision)
        .map_err(|e| napi::Error::from_reason(format!("Routing decision serialization failed: {}", e)))?;
    
    let metadata = JsExecutionMetadata {
        routing_decision: routing_decision_json,
        execution_time: result.metadata.execution_time as f64,
        tokens_used: result.metadata.tokens_used,
        service_used: result.metadata.service_used,
        was_load_balanced: result.metadata.was_load_balanced,
        confidence: result.metadata.confidence,
        performance_ratio: result.metadata.performance_ratio,
    };
    
    Ok(JsCoordinatedResult { response, metadata })
}

fn convert_multi_agent_result(result: MultiAgentCoordinationResult) -> napi::Result<JsMultiAgentResult> {
    let primary = JsExecutionResult {
        content: result.primary.content,
        model: result.primary.model,
        provider: result.primary.provider,
        tokens_used: result.primary.tokens_used,
        execution_time: result.primary.execution_time as f64,
        confidence: result.primary.confidence,
        metadata: serde_json::to_string(&result.primary.metadata)
            .unwrap_or_else(|_| "{}".to_string()),
    };
    
    let supporting = result.supporting.into_iter()
        .map(|exec_result| JsExecutionResult {
            content: exec_result.content,
            model: exec_result.model,
            provider: exec_result.provider,
            tokens_used: exec_result.tokens_used,
            execution_time: exec_result.execution_time as f64,
            confidence: exec_result.confidence,
            metadata: serde_json::to_string(&exec_result.metadata)
                .unwrap_or_else(|_| "{}".to_string()),
        })
        .collect();
    
    let coordination = serde_json::to_string(&result.coordination)
        .map_err(|e| napi::Error::from_reason(format!("Coordination serialization failed: {}", e)))?;
    
    Ok(JsMultiAgentResult {
        primary,
        supporting,
        coordination,
    })
}

fn convert_system_status(status: SystemStatus) -> napi::Result<JsSystemStatus> {
    let fast_models = serde_json::to_string(&status.fast_models)
        .map_err(|e| napi::Error::from_reason(format!("Fast models serialization failed: {}", e)))?;
    
    let services = serde_json::to_string(&status.services)
        .map_err(|e| napi::Error::from_reason(format!("Services serialization failed: {}", e)))?;
    
    let performance = serde_json::json!({
        "average_routing_time": status.performance.average_routing_time,
        "total_requests": status.performance.total_requests,
        "average_response_time": status.performance.average_response_time,
        "requests_per_second": status.performance.requests_per_second
    }).to_string();
    
    let load_balancing = serde_json::json!({
        "services": status.load_balancing.services,
        "last_health_check": status.load_balancing.last_health_check
    }).to_string();
    
    let resource_metrics = serde_json::json!({
        "service_loads": status.resource_metrics.service_loads,
        "healthy_services": status.resource_metrics.healthy_services,
        "error_rates": status.resource_metrics.error_rates
    }).to_string();
    
    Ok(JsSystemStatus {
        fast_models,
        services,
        performance,
        load_balancing,
        resource_metrics,
    })
}

fn convert_performance_metrics(metrics: crate::metrics::PerformanceMetrics) -> napi::Result<JsPerformanceMetrics> {
    let service_metrics = serde_json::to_string(&metrics.service_metrics)
        .map_err(|e| napi::Error::from_reason(format!("Service metrics serialization failed: {}", e)))?;
    
    let routing_metrics = serde_json::to_string(&metrics.routing_metrics)
        .map_err(|e| napi::Error::from_reason(format!("Routing metrics serialization failed: {}", e)))?;
    
    let load_balancing_metrics = serde_json::to_string(&metrics.load_balancing_metrics)
        .map_err(|e| napi::Error::from_reason(format!("Load balancing metrics serialization failed: {}", e)))?;
    
    Ok(JsPerformanceMetrics {
        total_requests: metrics.total_requests as f64,
        successful_requests: metrics.successful_requests as f64,
        failed_requests: metrics.failed_requests as f64,
        average_response_time: metrics.average_response_time,
        fastest_response_time: metrics.fastest_response_time,
        slowest_response_time: metrics.slowest_response_time,
        requests_per_second: metrics.requests_per_second,
        error_rate: metrics.error_rate,
        service_metrics,
        routing_metrics,
        load_balancing_metrics,
        timestamp: metrics.timestamp as f64,
    })
}