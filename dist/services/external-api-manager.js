import { createCircuitBreaker } from '../utils/circuit-breaker.js';
import { log, LogContext } from '../utils/logger.js';
const fetchApi = globalThis.fetch?.bind(globalThis);
class ExternalAPIManager {
    apis = new Map();
    rateLimits = new Map();
    requestHistory = new Map();
    breakers = new Map();
    constructor() {
        log.info('External API Manager initialized', LogContext.API);
    }
    async registerAPI(config) {
        try {
            if (!config.id || !config.name || !config.baseUrl) {
                throw new Error('Missing required API configuration fields');
            }
            try {
                const u = new URL(config.baseUrl);
                if (u.protocol !== 'http:' && u.protocol !== 'https:') {
                    throw new Error('Unsupported baseUrl scheme');
                }
            }
            catch (e) {
                throw new Error(`Invalid baseUrl: ${e instanceof Error ? e.message : String(e)}`);
            }
            if (config.enabled) {
                const testResponse = await this.testConnection(config);
                if (!testResponse.success) {
                    log.warn('API connection test failed', LogContext.API, {
                        apiId: config.id,
                        error: testResponse.error,
                    });
                    config.enabled = false;
                }
            }
            this.apis.set(config.id, config);
            this.initializeRateLimit(config.id, config.rateLimit);
            log.info('External API registered', LogContext.API, {
                apiId: config.id,
                name: config.name,
                serviceType: config.serviceType,
                enabled: config.enabled,
            });
            return true;
        }
        catch (error) {
            log.error('Failed to register external API', LogContext.API, {
                apiId: config.id,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async makeRequest(apiId, request) {
        const api = this.apis.get(apiId);
        if (!api) {
            return {
                success: false,
                error: `API with ID '${apiId}' not found`,
                statusCode: 404,
            };
        }
        if (!api.enabled) {
            return {
                success: false,
                error: `API '${apiId}' is disabled`,
                statusCode: 503,
            };
        }
        if (!this.checkRateLimit(apiId, api.rateLimit)) {
            return {
                success: false,
                error: 'Rate limit exceeded',
                statusCode: 429,
            };
        }
        try {
            let breaker = this.breakers.get(apiId);
            if (!breaker) {
                breaker = createCircuitBreaker(`external:${apiId}`, {
                    failureThreshold: 5,
                    successThreshold: 2,
                    timeout: 30000,
                    volumeThreshold: 10,
                    errorThresholdPercentage: 50,
                    rollingWindow: 60000,
                });
                this.breakers.set(apiId, breaker);
            }
            let target;
            try {
                target = new URL(request.endpoint, api.baseUrl);
            }
            catch {
                return { success: false, error: 'Invalid endpoint URL', statusCode: 400 };
            }
            if (target.protocol !== 'http:' && target.protocol !== 'https:') {
                return { success: false, error: 'Unsupported protocol', statusCode: 400 };
            }
            try {
                const base = new URL(api.baseUrl);
                if (base.hostname !== target.hostname) {
                    return { success: false, error: 'Cross-host request blocked', statusCode: 400 };
                }
            }
            catch {
                return { success: false, error: 'Invalid URL', statusCode: 400 };
            }
            const headers = {
                'Content-Type': 'application/json',
                ...api.headers,
                ...request.headers,
            };
            if (api.apiKey) {
                headers['Authorization'] = `Bearer ${api.apiKey}`;
            }
            const response = await breaker.execute(async () => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 15000);
                const resp = await fetchApi(target.toString(), {
                    method: request.method,
                    headers,
                    body: request.data ? JSON.stringify(request.data) : undefined,
                    redirect: 'follow',
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (!resp.ok && resp.status >= 500) {
                    throw new Error(`Upstream ${resp.status}`);
                }
                return resp;
            }, async () => {
                return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' },
                });
            });
            const ct = response.headers.get('content-type') || '';
            const responseData = ct.includes('application/json')
                ? await response.json().catch(() => null)
                : await response.text().catch(() => null);
            this.recordRequest(apiId);
            const result = {
                success: response.ok,
                data: responseData,
                statusCode: response.status,
                headers: Object.fromEntries(Array.from(response.headers)),
            };
            if (!response.ok) {
                result.error = responseData?.error || `HTTP ${response.status}`;
            }
            log.info('External API request completed', LogContext.API, {
                apiId,
                endpoint: request.endpoint,
                statusCode: response.status,
                success: response.ok,
            });
            return result;
        }
        catch (error) {
            log.error('External API request failed', LogContext.API, {
                apiId,
                endpoint: request.endpoint,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                statusCode: 500,
            };
        }
    }
    getAPIs() {
        return Array.from(this.apis.values());
    }
    getAPI(apiId) {
        return this.apis.get(apiId);
    }
    async updateAPI(apiId, updates) {
        const existing = this.apis.get(apiId);
        if (!existing) {
            return false;
        }
        const updated = { ...existing, ...updates };
        return this.registerAPI(updated);
    }
    removeAPI(apiId) {
        const removed = this.apis.delete(apiId);
        this.rateLimits.delete(apiId);
        this.requestHistory.delete(apiId);
        if (removed) {
            log.info('External API removed', LogContext.API, {
                apiId,
            });
        }
        return removed;
    }
    async toggleAPI(apiId, enabled) {
        const api = this.apis.get(apiId);
        if (!api) {
            return false;
        }
        if (enabled && !api.enabled) {
            const testResponse = await this.testConnection(api);
            if (!testResponse.success) {
                log.warn('Cannot enable API - connection test failed', LogContext.API, {
                    apiId,
                    error: testResponse.error,
                });
                return false;
            }
        }
        api.enabled = enabled;
        log.info('API status changed', LogContext.API, {
            apiId,
            enabled,
        });
        return true;
    }
    getAPIsByType(serviceType) {
        return this.getAPIs().filter((api) => api.serviceType === serviceType);
    }
    getAPIsWithCapability(capability) {
        return this.getAPIs().filter((api) => api.capabilities.includes(capability) && api.enabled);
    }
    async testConnection(config) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...config.headers,
            };
            if (config.apiKey) {
                headers['Authorization'] = `Bearer ${config.apiKey}`;
            }
            const response = await fetchApi(`${config.baseUrl}/health`, {
                method: 'GET',
                headers,
            });
            return {
                success: response.ok,
                statusCode: response.status,
                error: response.ok ? undefined : `HTTP ${response.status}`,
            };
        }
        catch (error) {
            return {
                success: false,
                statusCode: 500,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    initializeRateLimit(apiId, rateLimit) {
        if (!rateLimit) {
            return;
        }
        this.rateLimits.set(apiId, {
            requestsThisMinute: 0,
            requestsThisHour: 0,
            lastReset: new Date(),
        });
    }
    checkRateLimit(apiId, rateLimit) {
        if (!rateLimit) {
            return true;
        }
        const limit = this.rateLimits.get(apiId);
        if (!limit) {
            return true;
        }
        const now = new Date();
        const minuteAgo = new Date(now.getTime() - 60 * 1000);
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        if (limit.lastReset < minuteAgo) {
            limit.requestsThisMinute = 0;
            limit.lastReset = now;
        }
        if (limit.lastReset < hourAgo) {
            limit.requestsThisHour = 0;
        }
        return (limit.requestsThisMinute < rateLimit.requestsPerMinute &&
            limit.requestsThisHour < rateLimit.requestsPerHour);
    }
    recordRequest(apiId) {
        const limit = this.rateLimits.get(apiId);
        if (!limit) {
            return;
        }
        limit.requestsThisMinute++;
        limit.requestsThisHour++;
        const history = this.requestHistory.get(apiId) || [];
        history.push(new Date());
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const filteredHistory = history.filter((time) => time > hourAgo);
        this.requestHistory.set(apiId, filteredHistory);
    }
    getRateLimitStatus(apiId) {
        return this.rateLimits.get(apiId) || null;
    }
    getRequestHistory(apiId) {
        return this.requestHistory.get(apiId) || [];
    }
}
export const externalAPIManager = new ExternalAPIManager();
export default externalAPIManager;
//# sourceMappingURL=external-api-manager.js.map