/**
 * Prometheus Metrics Collection
 * Provides comprehensive metrics for monitoring and alerting
 */

import * as promClient from 'prom-client';
import type * as express from 'express';
import { LogContext, log } from './logger';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics for Universal AI Tools

// HTTP request metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});
register.registerMetric(httpRequestDuration);

// Agent execution metrics
export const agentExecutionDuration = new promClient.Histogram({
  name: 'agent_execution_duration_seconds',
  help: 'Duration of agent executions in seconds',
  labelNames: ['agent_name', 'success'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});
register.registerMetric(agentExecutionDuration);

export const agentExecutionTotal = new promClient.Counter({
  name: 'agent_execution_total',
  help: 'Total number of agent executions',
  labelNames: ['agent_name', 'success'],
});
register.registerMetric(agentExecutionTotal);

// LLM metrics
export const llmRequestDuration = new promClient.Histogram({
  name: 'llm_request_duration_seconds',
  help: 'Duration of LLM requests in seconds',
  labelNames: ['provider', 'model', 'success'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
});
register.registerMetric(llmRequestDuration);

export const llmTokensUsed = new promClient.Counter({
  name: 'llm_tokens_used_total',
  help: 'Total number of LLM tokens used',
  labelNames: ['provider', 'model', 'type'], // type: prompt, completion, total
});
register.registerMetric(llmTokensUsed);

// Service health metrics
export const serviceHealthStatus = new promClient.Gauge({
  name: 'service_health_status',
  help: 'Health status of services (1=healthy, 0.5=degraded, 0=unhealthy)',
  labelNames: ['service_name'],
});
register.registerMetric(serviceHealthStatus);

// Circuit breaker metrics
export const circuitBreakerStatus = new promClient.Gauge({
  name: 'circuit_breaker_status',
  help: 'Circuit breaker status (0=closed, 0.5=half-open, 1=open)',
  labelNames: ['service_name'],
});
register.registerMetric(circuitBreakerStatus);

// Memory and cache metrics
export const cacheHitRate = new promClient.Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_name'],
});
register.registerMetric(cacheHitRate);

export const memoryVectorCount = new promClient.Gauge({
  name: 'memory_vector_count',
  help: 'Number of vectors in memory storage',
  labelNames: ['collection'],
});
register.registerMetric(memoryVectorCount);

// Self-healing metrics
export const healingTasksProcessed = new promClient.Counter({
  name: 'healing_tasks_processed_total',
  help: 'Total number of healing tasks processed',
  labelNames: ['task_type', 'severity', 'success'],
});
register.registerMetric(healingTasksProcessed);

export const healingTaskDuration = new promClient.Histogram({
  name: 'healing_task_duration_seconds',
  help: 'Duration of healing tasks in seconds',
  labelNames: ['task_type', 'severity'],
  buckets: [1, 5, 10, 30, 60, 300, 600],
});
register.registerMetric(healingTaskDuration);

// Alert metrics
export const alertsSent = new promClient.Counter({
  name: 'alerts_sent_total',
  help: 'Total number of alerts sent',
  labelNames: ['channel', 'severity'],
});
register.registerMetric(alertsSent);

// WebSocket connection metrics
export const websocketConnections = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['namespace'],
});
register.registerMetric(websocketConnections);

// MCP integration metrics
export const mcpMessagesSent = new promClient.Counter({
  name: 'mcp_messages_sent_total',
  help: 'Total number of MCP messages sent',
  labelNames: ['method', 'success'],
});
register.registerMetric(mcpMessagesSent);

// Custom metric helpers

/**
 * Record an HTTP request
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number
): void {
  // Input validation
  if (typeof method !== 'string' || typeof route !== 'string' || 
      typeof statusCode !== 'number' || typeof duration !== 'number') {
    log.warn('Invalid parameters for recordHttpRequest', LogContext.SYSTEM, {
      method: typeof method,
      route: typeof route,
      statusCode: typeof statusCode,
      duration: typeof duration,
    });
    return;
  }

  if (duration < 0 || statusCode < 100 || statusCode > 599) {
    log.warn('Invalid values for recordHttpRequest', LogContext.SYSTEM, {
      statusCode,
      duration,
    });
    return;
  }

  httpRequestDuration.observe(
    { method, route, status_code: statusCode.toString() },
    duration / 1000 // Convert to seconds
  );
}

/**
 * Record an agent execution
 */
export function recordAgentExecution(
  agentName: string,
  success: boolean,
  duration: number
): void {
  agentExecutionDuration.observe(
    { agent_name: agentName, success: success.toString() },
    duration / 1000
  );
  agentExecutionTotal.inc({ agent_name: agentName, success: success.toString() });
}

/**
 * Record LLM usage
 */
export function recordLLMUsage(
  provider: string,
  model: string,
  success: boolean,
  duration: number,
  tokens?: { prompt: number; completion: number; total: number }
): void {
  llmRequestDuration.observe(
    { provider, model, success: success.toString() },
    duration / 1000
  );

  if (tokens) {
    llmTokensUsed.inc({ provider, model, type: 'prompt' }, tokens.prompt);
    llmTokensUsed.inc({ provider, model, type: 'completion' }, tokens.completion);
    llmTokensUsed.inc({ provider, model, type: 'total' }, tokens.total);
  }
}

/**
 * Update service health metric
 */
export function updateServiceHealth(serviceName: string, status: 'healthy' | 'degraded' | 'unhealthy'): void {
  const value = status === 'healthy' ? 1 : status === 'degraded' ? 0.5 : 0;
  serviceHealthStatus.set({ service_name: serviceName }, value);
}

/**
 * Update circuit breaker metric
 */
export function updateCircuitBreakerStatus(serviceName: string, state: 'CLOSED' | 'HALF_OPEN' | 'OPEN'): void {
  const value = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 0.5 : 1;
  circuitBreakerStatus.set({ service_name: serviceName }, value);
}

/**
 * Record healing task
 */
export function recordHealingTask(
  taskType: string,
  severity: string,
  success: boolean,
  duration: number
): void {
  healingTasksProcessed.inc({ task_type: taskType, severity, success: success.toString() });
  healingTaskDuration.observe({ task_type: taskType, severity }, duration / 1000);
}

/**
 * Record alert sent
 */
export function recordAlertSent(channel: string, severity: string): void {
  alertsSent.inc({ channel, severity });
}

/**
 * Update WebSocket connections
 */
export function updateWebSocketConnections(namespace: string, count: number): void {
  websocketConnections.set({ namespace }, count);
}

/**
 * Record MCP message
 */
export function recordMCPMessage(method: string, success: boolean): void {
  mcpMessagesSent.inc({ method, success: success.toString() });
}

/**
 * Get metrics for Prometheus endpoint
 */
export async function getMetrics(): Promise<string> {
  try {
    return await register.metrics();
  } catch (error) {
    log.error('❌ Failed to collect metrics', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.clear();
}

/**
 * Express middleware to record HTTP metrics
 */
export function httpMetricsMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const route = req.route?.path || req.path || 'unknown';
      recordHttpRequest(req.method, route, res.statusCode, duration);
    });

    next();
  };
}

// Export the registry for custom use
export { register };

log.info('📊 Prometheus metrics initialized', LogContext.SYSTEM);