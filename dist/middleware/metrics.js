import client from 'prom-client';
import { CircuitBreakerRegistry } from '@/utils/circuit-breaker';
export const metricsRegistry = new client.Registry();
client.collectDefaultMetrics({ register: metricsRegistry, prefix: 'universal_ai_' });
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [5, 10, 20, 50, 100, 200, 500, 1000, 2000],
    registers: [metricsRegistry],
});
const httpRequestsInFlight = new client.Gauge({
    name: 'http_requests_in_flight',
    help: 'In-flight HTTP requests',
    labelNames: ['route'],
    registers: [metricsRegistry],
});
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [metricsRegistry],
});
const httpRequestErrorsTotal = new client.Counter({
    name: 'http_request_errors_total',
    help: 'Total number of HTTP 5xx errors',
    labelNames: ['method', 'route', 'status_code'],
    registers: [metricsRegistry],
});
const cbTotalRequests = new client.Gauge({
    name: 'circuit_breaker_total_requests',
    help: 'Total requests observed by the circuit breaker',
    labelNames: ['breaker'],
    registers: [metricsRegistry],
});
const cbFailedRequests = new client.Gauge({
    name: 'circuit_breaker_failed_requests',
    help: 'Failed requests observed by the circuit breaker',
    labelNames: ['breaker'],
    registers: [metricsRegistry],
});
const cbRejectedRequests = new client.Gauge({
    name: 'circuit_breaker_rejected_requests',
    help: 'Requests rejected due to OPEN state',
    labelNames: ['breaker'],
    registers: [metricsRegistry],
});
const cbErrorRate = new client.Gauge({
    name: 'circuit_breaker_error_rate_percent',
    help: 'Error rate percentage within rolling window',
    labelNames: ['breaker'],
    registers: [metricsRegistry],
});
const cbConsecutiveFailures = new client.Gauge({
    name: 'circuit_breaker_consecutive_failures',
    help: 'Consecutive failures leading to state changes',
    labelNames: ['breaker'],
    registers: [metricsRegistry],
});
const cbOpen = new client.Gauge({
    name: 'circuit_breaker_open',
    help: 'Whether the breaker is OPEN (1) or not (0)',
    labelNames: ['breaker'],
    registers: [metricsRegistry],
});
const cbNextRetryTime = new client.Gauge({
    name: 'circuit_breaker_next_retry_time_ms',
    help: 'Epoch milliseconds for next retry attempt (if OPEN)',
    labelNames: ['breaker'],
    registers: [metricsRegistry],
});
function updateCircuitBreakerMetrics() {
    try {
        const metrics = CircuitBreakerRegistry.getMetrics();
        Object.entries(metrics).forEach(([name, m]) => {
            cbTotalRequests.labels(name).set(m.totalRequests);
            cbFailedRequests.labels(name).set(m.failedRequests);
            cbRejectedRequests.labels(name).set(m.rejectedRequests);
            cbErrorRate.labels(name).set(m.errorRate);
            cbConsecutiveFailures.labels(name).set(m.consecutiveFailures);
            cbOpen.labels(name).set(m.state === 'OPEN' ? 1 : 0);
            cbNextRetryTime.labels(name).set(m.nextRetryTime ? m.nextRetryTime : 0);
        });
    }
    catch {
    }
}
export function metricsMiddleware() {
    return (req, res, next) => {
        const route = (req.route?.path || req.path || 'unknown')
            .replace(/\d+/g, ':id')
            .replace(/[0-9a-f-]{36}/gi, ':uuid');
        httpRequestsInFlight.labels(route).inc();
        const start = process.hrtime.bigint();
        res.on('finish', () => {
            const end = process.hrtime.bigint();
            const durationMs = Number(end - start) / 1_000_000;
            httpRequestDuration.labels(req.method, route, String(res.statusCode)).observe(durationMs);
            httpRequestsInFlight.labels(route).dec();
            httpRequestsTotal.labels(req.method, route, String(res.statusCode)).inc();
            if (res.statusCode >= 500) {
                httpRequestErrorsTotal.labels(req.method, route, String(res.statusCode)).inc();
            }
            updateCircuitBreakerMetrics();
        });
        next();
    };
}
export async function getMetricsText() {
    return metricsRegistry.metrics();
}
export default metricsMiddleware;
//# sourceMappingURL=metrics.js.map